import os
import sys
import copy
import warnings

# Suppress noisy library output before importing heavy dependencies
os.environ["NEMO_LOG_LEVEL"] = "ERROR"          # Silence NeMo info/warning logs
os.environ["TRANSFORMERS_VERBOSITY"] = "error"   # Silence HuggingFace warnings
os.environ["TQDM_DISABLE"] = "1"                 # Disable tqdm progress bars globally
warnings.filterwarnings("ignore", category=UserWarning)

import numpy as np
import threading
import time

# Audio parameters - input from WebRTC
INPUT_SAMPLE_RATE = 48000
TARGET_SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit PCM

# Streaming parameters
# att_context_size = [left, right] in 80ms encoder frames
# [70, 13] → chunk = 14 frames × 80ms = 1120ms (best accuracy)
# [70, 6]  → chunk = 7 frames × 80ms = 560ms (lower latency)
# [70, 1]  → chunk = 2 frames × 80ms = 160ms (lowest latency)
# [70, 0]  → chunk = 1 frame × 80ms = 80ms (ultra-low latency)
ENCODER_STEP_LENGTH = 80  # ms per encoder output frame
ATT_CONTEXT_RIGHT = 13    # right context frames
CHUNK_SIZE_MS = (1 + ATT_CONTEXT_RIGHT) * ENCODER_STEP_LENGTH  # 1120ms


def resample(audio_np, orig_sr, target_sr):
    """Simple linear interpolation resampling."""
    if orig_sr == target_sr:
        return audio_np
    ratio = target_sr / orig_sr
    new_length = int(len(audio_np) * ratio)
    indices = np.linspace(0, len(audio_np) - 1, new_length)
    return np.interp(indices, np.arange(len(audio_np)), audio_np).astype(np.float32)


def init_preprocessor(asr_model):
    """Create a streaming-compatible preprocessor from the model's config.

    For streaming, we disable dithering, padding, and normalization so that
    each chunk can be preprocessed independently with consistent results.
    """
    from omegaconf import OmegaConf

    cfg = copy.deepcopy(asr_model._cfg)
    OmegaConf.set_struct(cfg.preprocessor, False)
    cfg.preprocessor.dither = 0.0
    cfg.preprocessor.pad_to = 0
    cfg.preprocessor.normalize = "None"

    preprocessor = asr_model.from_config_dict(cfg.preprocessor)
    preprocessor.to(asr_model.device)
    return preprocessor


def main():
    import torch
    import nemo.collections.asr as nemo_asr
    from omegaconf import open_dict
    from nemo.collections.asr.parts.utils.rnnt_utils import Hypothesis

    # --- Start stdin reader immediately ---
    # Audio flows into stdin from the moment the child process is spawned.
    # We must drain it continuously during model loading to prevent the OS
    # pipe buffer from filling up and blocking the parent process.
    buffer_lock = threading.Lock()
    audio_buffer = bytearray()
    done = threading.Event()

    def read_stdin():
        """Read raw PCM audio from stdin into a shared buffer."""
        nonlocal audio_buffer
        while not done.is_set():
            try:
                data = sys.stdin.buffer.read(4096)
                if len(data) == 0:
                    done.set()
                    break
                with buffer_lock:
                    audio_buffer.extend(data)
            except (KeyboardInterrupt, IOError):
                done.set()
                break

    reader_thread = threading.Thread(target=read_stdin, daemon=True)
    reader_thread.start()

    # Select the best available device
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    print(
        f"Loading nemotron-speech-streaming-en-0.6b (device: {device})...",
        file=sys.stderr,
    )

    asr_model = nemo_asr.models.ASRModel.from_pretrained(
        model_name="nvidia/nemotron-speech-streaming-en-0.6b"
    )

    # Configure streaming context size
    left_context = asr_model.encoder.att_context_size[0]
    asr_model.encoder.set_default_att_context_size(
        [left_context, ATT_CONTEXT_RIGHT]
    )

    # Configure RNNT greedy decoding optimised for streaming
    decoding_cfg = asr_model.cfg.decoding
    with open_dict(decoding_cfg):
        decoding_cfg.strategy = "greedy"
        decoding_cfg.preserve_alignments = False
        if hasattr(decoding_cfg, "greedy"):
            decoding_cfg.greedy.max_symbols = 10
        decoding_cfg.fused_batch_size = -1
    asr_model.change_decoding_strategy(decoding_cfg)

    asr_model.eval()

    # Cache-aware models require float32 computation
    asr_model = asr_model.to(device=device, dtype=torch.float32)

    # --- Streaming state initialisation ---

    # Mel-spectrogram preprocessor (separate from model to avoid dithering)
    preprocessor = init_preprocessor(asr_model)

    # Encoder cache state (channel + time caches for all layers)
    cache_last_channel, cache_last_time, cache_last_channel_len = (
        asr_model.encoder.get_initial_cache_state(batch_size=1)
    )

    # Pre-encode cache: a small window of mel features from the previous chunk
    # is prepended to the current chunk for continuity in the convolution layers
    _pecs = asr_model.encoder.streaming_cfg.pre_encode_cache_size
    pre_encode_cache_size = _pecs[1] if isinstance(_pecs, list) else _pecs
    num_channels = asr_model.cfg.preprocessor.features
    cache_pre_encode = torch.zeros(
        (1, num_channels, pre_encode_cache_size), device=asr_model.device
    )

    # RNNT decoder state
    previous_hypotheses = None
    pred_out_stream = None
    step_num = 0
    prev_text = ""

    # Flush any audio that accumulated in the buffer during model loading.
    # This stale audio (ambient noise, etc.) would otherwise produce garbage
    # transcriptions at the start of the stream.
    with buffer_lock:
        discarded = len(audio_buffer)
        audio_buffer.clear()
    if discarded > 0:
        duration_s = discarded / (INPUT_SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS)
        print(
            f"Flushed {discarded} bytes ({duration_s:.1f}s) of stale audio buffered during model load.",
            file=sys.stderr,
        )

    print("Model loaded, streaming ready.", file=sys.stderr)

    # Signal readiness to the parent process (convention: >READY on stdout)
    print(">READY")
    sys.stdout.flush()

    # Bytes needed for one chunk at the input sample rate
    chunk_samples_48k = int(INPUT_SAMPLE_RATE * CHUNK_SIZE_MS / 1000)
    bytes_per_chunk = chunk_samples_48k * SAMPLE_WIDTH * CHANNELS

    def transcribe_chunk(audio_16k, is_last=False):
        """Process a single audio chunk through the cache-aware streaming model.

        Each call maintains encoder + decoder state so that the model
        accumulates context across chunks for better accuracy.
        """
        nonlocal cache_last_channel, cache_last_time, cache_last_channel_len
        nonlocal previous_hypotheses, pred_out_stream, step_num
        nonlocal cache_pre_encode, prev_text

        # Convert numpy audio to tensor
        audio_signal = torch.from_numpy(audio_16k).unsqueeze_(0).to(asr_model.device)
        audio_signal_len = torch.tensor(
            [audio_16k.shape[0]], device=asr_model.device
        )

        # Compute mel-spectrogram features for this chunk
        processed_signal, processed_signal_length = preprocessor(
            input_signal=audio_signal, length=audio_signal_len
        )

        # Prepend mel feature cache from the previous chunk for convolution
        # layer continuity (zero-padded for the very first chunk)
        processed_signal = torch.cat(
            [cache_pre_encode, processed_signal], dim=-1
        )
        processed_signal_length += cache_pre_encode.shape[2]

        # Save the tail of the current features as cache for the next chunk
        cache_pre_encode = processed_signal[:, :, -pre_encode_cache_size:]

        # Run one streaming inference step
        with torch.no_grad():
            (
                pred_out_stream,
                transcribed_texts,
                cache_last_channel,
                cache_last_time,
                cache_last_channel_len,
                previous_hypotheses,
            ) = asr_model.conformer_stream_step(
                processed_signal=processed_signal,
                processed_signal_length=processed_signal_length,
                cache_last_channel=cache_last_channel,
                cache_last_time=cache_last_time,
                cache_last_channel_len=cache_last_channel_len,
                keep_all_outputs=is_last,
                previous_hypotheses=previous_hypotheses,
                previous_pred_out=pred_out_stream,
                drop_extra_pre_encoded=None,
                return_transcription=True,
            )

        # Extract text from hypothesis
        if isinstance(transcribed_texts[0], Hypothesis):
            accumulated = transcribed_texts[0].text
        else:
            accumulated = str(transcribed_texts[0])

        # Output only the new (delta) text to avoid repeating the full
        # transcription each step. The streaming RNNT decoder is monotonic
        # so the accumulated text only grows.
        if accumulated and len(accumulated) > len(prev_text):
            if accumulated.startswith(prev_text):
                delta = accumulated[len(prev_text):].strip()
            else:
                # Fallback: text was revised (rare with cache-aware streaming)
                delta = accumulated.strip()

            if delta:
                print(">" + delta)
                sys.stdout.flush()

        prev_text = accumulated
        step_num += 1

    # --- Main processing loop ---
    while not done.is_set():
        time.sleep(0.05)

        with buffer_lock:
            if len(audio_buffer) < bytes_per_chunk:
                continue
            chunk = bytes(audio_buffer[:bytes_per_chunk])
            audio_buffer = audio_buffer[bytes_per_chunk:]

        # Convert raw PCM bytes to float32 and resample 48kHz → 16kHz
        pcm_int16 = np.frombuffer(chunk, dtype=np.int16)
        pcm_float = pcm_int16.astype(np.float32) / 32768.0
        audio_16k = resample(pcm_float, INPUT_SAMPLE_RATE, TARGET_SAMPLE_RATE)

        try:
            transcribe_chunk(audio_16k)
        except Exception as e:
            print(f"Transcription error: {e}", file=sys.stderr)

    # Flush remaining audio (final step with keep_all_outputs=True)
    with buffer_lock:
        remaining = bytes(audio_buffer)
        audio_buffer = bytearray()

    if len(remaining) > SAMPLE_WIDTH * 100:
        pcm_int16 = np.frombuffer(remaining, dtype=np.int16)
        pcm_float = pcm_int16.astype(np.float32) / 32768.0
        audio_16k = resample(pcm_float, INPUT_SAMPLE_RATE, TARGET_SAMPLE_RATE)
        try:
            transcribe_chunk(audio_16k, is_last=True)
        except Exception:
            pass

    print("Nemotron streaming STT stopped.", file=sys.stderr)


if __name__ == "__main__":
    main()
