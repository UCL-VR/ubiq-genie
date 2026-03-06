import { NetworkId } from 'ubiq-server/ubiq';
import { ApplicationController } from '../../components/application';
import { MediaReceiver } from '../../components/media_receiver';
import { MessageReader } from '../../components/message_reader';
import { VisualQuestionAnsweringService } from '../../services/visual_question_answering/service';
import { createFastVLMProvider } from '../../services/visual_question_answering/providers/fastvlm/provider';
import { TextToSpeechService } from '../../services/text_to_speech/service';
import { KokoroTTSProvider } from '../../services/text_to_speech/providers/kokoro/provider';
import path from 'path';
import { fileURLToPath } from 'url';
import nconf from 'nconf';

/** Network ID used to send description text to Unity clients. */
const DESCRIPTION_NETWORK_ID = 98;

/** Network ID used to send TTS audio to Unity clients. */
const AUDIO_NETWORK_ID = 96;

/** Network ID used to receive manual trigger messages from Unity. */
const TRIGGER_NETWORK_ID = 100;

/**
 * Automatically send a frame to the VQA service at most once every N ms.
 * Set to 0 to disable periodic processing (manual trigger only).
 */
const FRAME_INTERVAL_MS = 0;

/**
 * StreamDescriber ingests a video stream (with track ID "description_stream")
 * via MediaReceiver, forwards frames to a VisualQuestionAnsweringService
 * (FastVLM), and sends the resulting text description to Unity clients over
 * a fixed network ID.
 */
class StreamDescriber extends ApplicationController {
    components: {
        mediaReceiver?: MediaReceiver;
        triggerReader?: MessageReader;
        vqa?: VisualQuestionAnsweringService;
        tts?: TextToSpeechService;
    } = {};

    /** Timestamp of the last frame sent per peer, to throttle. */
    private lastFrameTime = new Map<string, number>();

    /** Most recent video frame per peer, kept for manual trigger use. */
    private latestFrame = new Map<string, { width: number; height: number; data: Buffer }>();

    /** Buffer for accumulating partial stdout lines from the VQA process. */
    private stdoutBuffer = '';

    /** Whether the VQA child process has signalled readiness. */
    private vqaReady = false;

    /** Whether the TTS child process has signalled readiness. */
    private ttsReady = false;

    /**
     * Accumulates TTS audio buffers for the current description.
     * Flushed to Unity once TTS finishes (detected by the next description
     * or a flush timeout).
     */
    private ttsAudioBuffers: Buffer[] = [];
    private ttsFlushTimer: ReturnType<typeof setTimeout> | null = null;

    /** How long to wait after the last TTS chunk before flushing (ms). */
    private static readonly TTS_FLUSH_DELAY_MS = 300;

    constructor(configFile: string = 'config.json') {
        super(configFile);
    }

    start(): void {
        this.registerComponents();
        this.log(`Components registered: ${Object.keys(this.components).join(', ')}`);

        this.definePipeline();
        this.log('Pipeline defined');

        this.joinRoom();
    }

    /** Whether TTS is enabled via config. */
    private get ttsEnabled(): boolean {
        return nconf.get('tts') === true;
    }

    registerComponents(): void {
        // MediaReceiver to receive video tracks sent by MediaTrackManager
        this.components.mediaReceiver = new MediaReceiver(this.scene);

        // MessageReader to receive manual trigger messages from Unity (spacebar)
        this.components.triggerReader = new MessageReader(this.scene, TRIGGER_NETWORK_ID);

        // VisualQuestionAnsweringService (official ml-fastvlm)
        const vqaProvider = createFastVLMProvider({
            modelPath: nconf.get('fastvlmModelPath'),
        });
        this.components.vqa = new VisualQuestionAnsweringService(this.scene, vqaProvider);

        // Optional: TextToSpeechService to convert descriptions to audio
        if (this.ttsEnabled) {
            this.components.tts = new TextToSpeechService(this.scene, KokoroTTSProvider);
            this.log('TTS enabled — descriptions will also be sent as audio (Kokoro)');
        }
    }

    /** Send a stored frame to the VQA child process. */
    private sendFrameToVQA(uuid: string): void {
        const frame = this.latestFrame.get(uuid);
        if (!frame) {
            this.log(`[Trigger] No stored frame for ${uuid}`);
            return;
        }

        const prompt: string | undefined = nconf.get('prompt');
        const header = JSON.stringify({
            width: frame.width,
            height: frame.height,
            ...(prompt ? { prompt } : {}),
        }) + '\n';

        this.components.vqa?.sendToChildProcess('default', header);
        this.components.vqa?.sendToChildProcess('default', frame.data);
    }

    definePipeline(): void {
        // --- Step 1: Receive video frames and forward to VQA service ---
        this.components.mediaReceiver?.on(
            'video',
            (trackId: string, uuid: string, frame: any) => {
                // Only process the designated stream
                if (trackId !== 'description_stream') {
                    console.warn(`Ignoring track ${trackId} from ${uuid}`);
                    return;
                }

                if (!frame || !frame.width || !frame.height || !frame.data) {
                    return;
                }

                // Always store the latest frame so manual triggers can use it
                this.latestFrame.set(uuid, {
                    width: frame.width,
                    height: frame.height,
                    data: Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength),
                });

                // Don't send frames until the VQA model is ready
                if (!this.vqaReady) {
                    return;
                }

                // Periodic auto-describe (disabled when FRAME_INTERVAL_MS is 0)
                if (FRAME_INTERVAL_MS > 0) {
                    const now = Date.now();
                    const last = this.lastFrameTime.get(uuid) ?? 0;
                    if (now - last < FRAME_INTERVAL_MS) {
                        return;
                    }
                    this.lastFrameTime.set(uuid, now);

                    this.sendFrameToVQA(uuid);
                }
            },
        );

        // --- Step 1b: Manual trigger from Unity (spacebar) ---
        this.components.triggerReader?.on('data', (msg: { message: Buffer }) => {
            if (!this.vqaReady) {
                this.log('[Trigger] Ignoring trigger — VQA not ready');
                return;
            }

            this.log('[Trigger] Manual describe requested');

            // Send the latest frame from any peer
            for (const uuid of this.latestFrame.keys()) {
                this.sendFrameToVQA(uuid);
                break; // just use the first (usually only) peer
            }
        });

        // --- Step 2: When VQA service returns a result, send it to Unity ---
        // stdout data events can deliver partial lines, so we accumulate
        // a buffer and split on newlines.
        this.components.vqa?.on('data', (data: Buffer, _identifier: string) => {
            this.stdoutBuffer += data.toString();

            // Process all complete lines in the buffer
            let newlineIdx: number;
            while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
                const line = this.stdoutBuffer.slice(0, newlineIdx).trim();
                this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);

                if (!line) {
                    continue;
                }

                // Check for the readiness signal from the VQA child process
                if (line === '>READY') {
                    this.vqaReady = true;
                    this.log('VQA service is ready');
                    continue;
                }

                try {
                    const parsed = JSON.parse(line);
                    if (parsed.description) {
                        // Clean the description: collapse whitespace, take first paragraph
                        const cleaned = parsed.description
                            .replace(/\s+/g, ' ')
                            .trim();

                        if (!cleaned) continue;

                        this.log(`Description: ${cleaned}`);

                        // Send the text description to Unity
                        this.scene.send(new NetworkId(DESCRIPTION_NETWORK_ID), {
                            data: cleaned,
                        });

                        // If TTS is enabled + ready, flush any old audio and
                        // start a new speech sequence.
                        if (this.ttsEnabled && this.ttsReady && this.components.tts) {
                            this.flushTtsAudio();   // send any remaining audio from previous description
                            this.components.tts.sendToChildProcess(
                                'default',
                                cleaned + '\n',
                            );
                        }
                    }
                } catch (e) {
                    this.log(`Failed to parse VQA output: ${line}`, 'warning');
                }
            }
        });

        // --- Step 3: Accumulate TTS audio and flush as a single sequence ---
        if (this.ttsEnabled && this.components.tts) {
            const READY_MARKER = Buffer.from('>READY\n');
            let preReadyBuffer = Buffer.alloc(0);

            this.components.tts.on('data', (data: Buffer, _identifier: string) => {
                // Gate on readiness
                if (!this.ttsReady) {
                    preReadyBuffer = Buffer.concat([preReadyBuffer, data]);
                    const markerIdx = preReadyBuffer.indexOf(READY_MARKER);
                    if (markerIdx === -1) return;
                    this.ttsReady = true;
                    this.log('TTS service is ready');
                    const remainder = preReadyBuffer.subarray(markerIdx + READY_MARKER.length);
                    preReadyBuffer = Buffer.alloc(0);
                    if (remainder.length === 0) return;
                    // Fall through with remainder as first audio data
                    this.accumulateTtsChunk(remainder);
                    return;
                }

                this.accumulateTtsChunk(data);
            });
        }
    }

    // ---- TTS audio accumulation helpers ----

    /**
     * Buffer a chunk of TTS audio and (re)start the flush timer.
     * Kokoro streams many small chunks per sentence. We accumulate them
     * and send a single AudioInfo + contiguous audio burst to Unity once
     * the stream settles (no new data for TTS_FLUSH_DELAY_MS).
     */
    private accumulateTtsChunk(data: Buffer): void {
        this.ttsAudioBuffers.push(data);

        // Reset the flush timer — flush once TTS stops producing
        if (this.ttsFlushTimer !== null) {
            clearTimeout(this.ttsFlushTimer);
        }
        this.ttsFlushTimer = setTimeout(
            () => this.flushTtsAudio(),
            StreamDescriber.TTS_FLUSH_DELAY_MS,
        );
    }

    /**
     * Send all accumulated TTS audio to Unity as ONE sequence:
     *   1. A single AudioInfo header (total byte length)
     *   2. Contiguous PCM16 data in ≤16 000-byte chunks
     */
    private flushTtsAudio(): void {
        if (this.ttsFlushTimer !== null) {
            clearTimeout(this.ttsFlushTimer);
            this.ttsFlushTimer = null;
        }

        if (this.ttsAudioBuffers.length === 0) return;

        const combined = Buffer.concat(this.ttsAudioBuffers);
        this.ttsAudioBuffers = [];

        if (combined.length === 0) return;

        this.log(`Sending ${combined.length} bytes of TTS audio to Unity`);

        // One AudioInfo for the entire speech sequence
        this.scene.send(new NetworkId(AUDIO_NETWORK_ID), {
            type: 'AudioInfo',
            audioLength: combined.length.toString(),
        });

        // Stream the raw PCM16 data
        let offset = 0;
        while (offset < combined.length) {
            const end = Math.min(offset + 16000, combined.length);
            this.scene.send(new NetworkId(AUDIO_NETWORK_ID), combined.subarray(offset, end));
            offset = end;
        }
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new StreamDescriber(absConfigPath);
    app.start();
}

export { StreamDescriber };
