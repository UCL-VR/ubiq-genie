"""
Kokoro-82M local text-to-speech with streaming output.

Reads text lines from stdin, synthesizes speech using the Kokoro-82M model,
and streams raw 48kHz 16-bit mono PCM audio to stdout as chunks are generated.

Kokoro natively generates audio at 24kHz. Each sample is duplicated to produce
48kHz output compatible with the rest of the audio pipeline.
"""

import sys
import numpy as np
import torch
from kokoro import KPipeline

KOKORO_SAMPLE_RATE = 24000
TARGET_SAMPLE_RATE = 48000
VOICE = "af_heart"
LANG_CODE = "a"  # American English


def load_pipeline():
    """Load the Kokoro pipeline once at startup."""
    print("Loading Kokoro-82M pipeline...", file=sys.stderr)
    pipeline = KPipeline(lang_code=LANG_CODE)
    print("Kokoro-82M pipeline loaded.", file=sys.stderr)
    return pipeline


def to_numpy(audio) -> np.ndarray:
    """Convert audio to a numpy float32 array, handling both tensors and arrays."""
    if isinstance(audio, torch.Tensor):
        return audio.detach().cpu().float().numpy()
    return np.asarray(audio, dtype=np.float32)


def upsample_24k_to_48k(audio_24k: np.ndarray) -> np.ndarray:
    """Upsample from 24kHz to 48kHz by duplicating each sample."""
    return np.repeat(audio_24k, 2)


def audio_to_pcm16(audio: np.ndarray) -> bytes:
    """Convert float32 audio [-1, 1] to 16-bit signed PCM bytes."""
    audio = np.clip(audio, -1.0, 1.0)
    pcm = (audio * 32767).astype(np.int16)
    return pcm.tobytes()


def synthesize_and_stream(pipeline, text: str):
    """
    Generate speech for the given text and stream PCM chunks to stdout.

    The Kokoro pipeline yields audio in sentence-level chunks, allowing
    us to start sending audio as soon as the first sentence is ready.
    """
    generator = pipeline(text, voice=VOICE)
    for _i, (_graphemes, _phonemes, audio_chunk) in enumerate(generator):
        if audio_chunk is not None and len(audio_chunk) > 0:
            # Convert to numpy (Kokoro may return torch tensors)
            audio_np = to_numpy(audio_chunk)
            # Upsample 24kHz -> 48kHz
            audio_48k = upsample_24k_to_48k(audio_np)
            pcm_bytes = audio_to_pcm16(audio_48k)
            sys.stdout.buffer.write(pcm_bytes)
            sys.stdout.buffer.flush()


def main():
    pipeline = load_pipeline()

    # Signal readiness to the parent process (convention: >READY on stdout)
    sys.stdout.buffer.write(b">READY\n")
    sys.stdout.buffer.flush()

    while True:
        try:
            text = input()
            if text.strip():
                sys.stdout.buffer.write(b">BUSY\n")
                sys.stdout.buffer.flush()

                synthesize_and_stream(pipeline, text.strip())

                sys.stdout.buffer.write(b">IDLE\n")
                sys.stdout.buffer.flush()
        except (KeyboardInterrupt, EOFError):
            break


if __name__ == "__main__":
    main()
