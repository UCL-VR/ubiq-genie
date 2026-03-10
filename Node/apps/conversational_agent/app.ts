import { ApplicationController } from '../../components/application';
import { TextToSpeechService } from '../../services/text_to_speech/service';
import { SpeechToTextService } from '../../services/speech_to_text/service';
import { TextGenerationService } from '../../services/text_generation/service';
import { AudioToAudioService } from '../../services/audio_to_audio/service';
import { VoipReceiver } from '../../components/voip_receiver';
import { AudioSender } from '../../components/audio_sender';
import {
    encodePacket,
    LengthPrefixedParser,
    KIND_HANDSHAKE,
    KIND_AUDIO,
    KIND_TEXT,
    KIND_ERROR,
    downsample48kTo24k,
    upsample24kTo48k,
} from '../../services/audio_to_audio/providers/personaplex/index';
import path from 'path';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { fileURLToPath } from 'url';
import nconf from 'nconf';

/**
 * How many milliseconds of model audio to accumulate before flushing to Unity.
 * Batching reduces AudioInfo message overhead and gives Unity's audio system
 * a larger buffer to work with, preventing playback stutter / latency.
 *
 * The model produces one 80 ms frame per step (~12.5 fps).
 * 240 ms ≈ 3 frames — a good trade-off between latency and smoothness.
 * Override with UBIQ_AUDIO_BATCH_MS.
 */
const AUDIO_BATCH_MS = Number(process.env.UBIQ_AUDIO_BATCH_MS) || 240;

export class ConversationalAgent extends ApplicationController {
    components: {
        voipReceiver?: VoipReceiver;
        speech2text?: SpeechToTextService;
        textGenerationService?: TextGenerationService;
        textToSpeechService?: TextToSpeechService;
        audioToAudioService?: AudioToAudioService;
    } = {};

    /** Shared sender that handles AudioInfo headers + chunked PCM protocol. */
    private audioSender!: AudioSender;
    targetPeerQueue: string[] = [];

    /** Tracks the UUID of the peer that most recently sent audio. */
    private lastAudioSenderUuid: string = '';

    /** Whether the PersonaPlex handshake has been received. */
    private personaplexReady: boolean = false;

    /** Parser instance for decoding PersonaPlex stdout framing. */
    private stdoutParser: LengthPrefixedParser = new LengthPrefixedParser();

    // --- Audio output batching ---
    /** Accumulated audio buffers (48 kHz PCM16LE) waiting to be sent to Unity. */
    private audioOutputQueue: Buffer[] = [];
    /** Total byte length of buffers currently in audioOutputQueue. */
    private audioOutputQueueBytes: number = 0;
    /** Timer handle for the periodic audio flush. */
    private audioFlushTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(configFile: string = 'config.json') {
        super(configFile);
    }

    /** Whether the app is configured to use audio-to-audio mode. */
    private get useAudioToAudio(): boolean {
        return nconf.get('useAudioToAudio') === true;
    }

    start(): void {
        // STEP 1: Register services (and any other components) used by the application
        this.registerComponents();
        this.log(`Services registered: ${Object.keys(this.components).join(', ')}`);

        // STEP 2: Define the application pipeline
        this.definePipeline();
        this.log('Pipeline defined');

        // STEP 3: Join a room based on the configuration (optionally creates a server)
        this.joinRoom();
    }

    registerComponents() {
        // Centralised audio sender — includes sampleRate in every AudioInfo header
        this.audioSender = new AudioSender(this.scene, 95, 48000);

        // A VoipReceiver to receive audio data from peers via WebRTC VOIP
        this.components.voipReceiver = new VoipReceiver(this.scene);

        if (this.useAudioToAudio) {
            // Audio-to-audio mode: provider auto-resolved from config.json services section
            this.components.audioToAudioService = new AudioToAudioService(this.scene);
            this.log('Using audio-to-audio pipeline (resolved from config)');
        } else {
            // Traditional pipeline: STT → text generation → TTS (all auto-resolved from config)
            this.components.speech2text = new SpeechToTextService(this.scene);
            this.components.textGenerationService = new TextGenerationService(this.scene);
            this.components.textToSpeechService = new TextToSpeechService(this.scene);
            this.log('Using traditional STT → text generation → TTS pipeline');
        }
    }

    definePipeline() {
        if (this.useAudioToAudio) {
            this.defineAudioToAudioPipeline();
        } else {
            this.defineTraditionalPipeline();
        }
    }

    /**
     * Audio-to-audio pipeline: audio from peers is downsampled to 24 kHz,
     * framed with the PersonaPlex binary protocol, and sent to the model.
     * Model output (audio + text) is parsed, upsampled to 48 kHz, batched,
     * and sent to Unity periodically (every AUDIO_BATCH_MS milliseconds).
     */
    private defineAudioToAudioPipeline() {
        const service = this.components.audioToAudioService!;

        // ---- Input: receive 48 kHz PCM16 from WebRTC ----
        this.components.voipReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            if (this.roomClient.peers.get(uuid) === undefined) {
                return;
            }

            // Don't send audio to the model before it's ready — it would pile
            // up in the OS pipe buffer and create a stale backlog.
            if (!this.personaplexReady) {
                return;
            }

            this.lastAudioSenderUuid = uuid;

            const sampleBuffer = Buffer.from(data.samples.buffer);
            const downsampled = downsample48kTo24k(sampleBuffer);
            const packet = encodePacket(KIND_AUDIO, downsampled);

            service.sendToChildProcess('default', packet);
        });

        // ---- Output: parse framed stdout from PersonaPlex ----
        service.on('data', (data: Buffer, _identifier: string) => {
            let packets;
            try {
                packets = this.stdoutParser.feed(data);
            } catch (err) {
                this.log(`Protocol parse error: ${err}`, 'error');
                return;
            }

            for (const packet of packets) {
                switch (packet.kind) {
                    case KIND_HANDSHAKE:
                        this.personaplexReady = true;
                        this.log('PersonaPlex handshake received — model is ready');
                        break;

                    case KIND_AUDIO: {
                        const upsampled = upsample24kTo48k(packet.payload);
                        this.enqueueAudioForUnity(upsampled);
                        break;
                    }

                    case KIND_TEXT: {
                        const text = packet.payload.toString('utf-8');
                        this.logStream(text);
                        break;
                    }

                    case KIND_ERROR: {
                        const errorMsg = packet.payload.toString('utf-8');
                        this.log(`PersonaPlex error: ${errorMsg}`, 'error');
                        break;
                    }

                    default:
                        this.log(`Unknown PersonaPlex packet kind: ${packet.kind}`, 'warning');
                        break;
                }
            }
        });

        service.on('close', (code: number | null, signal: string | null, identifier: string) => {
            this.flushAudioToUnity();
            this.flushStream();
            this.log(`PersonaPlex process ${identifier} exited (code=${code}, signal=${signal})`, 'warning');
            this.personaplexReady = false;
            this.stdoutParser.reset();
        });
    }

    // ---- Audio output batching helpers ----

    /**
     * Queue upsampled audio and schedule a batched send to Unity.
     *
     * Instead of sending each 80 ms model frame individually (which causes
     * Unity to receive a new AudioInfo message 12.5×/sec and potentially
     * introduces playback startup overhead per message), we accumulate
     * frames and flush them as one larger AudioInfo batch every AUDIO_BATCH_MS.
     */
    private enqueueAudioForUnity(upsampled: Buffer): void {
        this.audioOutputQueue.push(upsampled);
        this.audioOutputQueueBytes += upsampled.length;

        // Start the flush timer on the first enqueued frame
        if (this.audioFlushTimer === null) {
            this.audioFlushTimer = setTimeout(() => this.flushAudioToUnity(), AUDIO_BATCH_MS);
        }
    }

    /**
     * Flush all queued audio to Unity as a single AudioInfo + data batch.
     */
    private flushAudioToUnity(): void {
        if (this.audioFlushTimer !== null) {
            clearTimeout(this.audioFlushTimer);
            this.audioFlushTimer = null;
        }

        if (this.audioOutputQueue.length === 0) {
            return;
        }

        const combined = Buffer.concat(this.audioOutputQueue);
        this.audioOutputQueue = [];
        this.audioOutputQueueBytes = 0;

        // Resolve target peer
        const targetPeerObj = this.roomClient.peers.get(this.lastAudioSenderUuid);
        const targetPeer = targetPeerObj?.properties.get('ubiq.displayname') ?? '';

        this.audioSender.send(combined, { targetPeer });
    }

    /**
     * Traditional 3-stage pipeline: STT → text generation → TTS.
     * This is the original pipeline, preserved for backwards compatibility.
     */
    private defineTraditionalPipeline() {
        // Step 1: When we receive audio data from a peer we send it to the transcription service
        this.components.voipReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            // Convert the Int16Array to a Buffer
            const sampleBuffer = Buffer.from(data.samples.buffer);

            // Send the audio data to the transcription service
            if (this.roomClient.peers.get(uuid) !== undefined) {
                this.components.speech2text?.sendToChildProcess(uuid, sampleBuffer);
            }
        });

        // Step 2: When we receive a response from the transcription service, we send it to the text generation service
        this.components.speech2text?.on('data', (data: Buffer, identifier: string) => {
            // We obtain the peer object from the room client using the identifier
            const peer = this.roomClient.peers.get(identifier);
            const peerName = peer?.properties.get('ubiq.displayname');

            let response = data.toString();

            // Remove all newlines from the response
            response = response.replace(/(\r\n|\n|\r)/gm, '');
            if (response.startsWith('>')) {
                response = response.slice(1); // Slice off the leading '>' character
                if (response.trim()) {
                    const message = (peerName + ' -> Agent:: ' + response).trim();
                    this.log(message);

                    this.components.textGenerationService?.sendToChildProcess('default', message + '\n');
                }
            }
        });

        // Step 3: When we receive a response from the text generation service, we send it to the text to speech service
        this.components.textGenerationService?.on('data', (data: Buffer, identifier: string) => {
            const response = data.toString();
            this.log('Received text generation response from child process ' + identifier + ': ' + response, 'info');

            // Parse target peer from the response (Agent -> TargetPeer: Message)
            const [, name, message] = response.match(/-> (.*?):: (.*)/) || [];

            if (!name || !message) {
                this.log('Error parsing target peer and message', 'error');
                return;
            }

            this.targetPeerQueue.push(name.trim());
            this.components.textToSpeechService?.sendToChildProcess('default', message.trim() + '\n');
        });

        this.components.textToSpeechService?.on('data', (data: Buffer, identifier: string) => {
            const targetPeer = this.targetPeerQueue.shift() ?? '';
            this.audioSender.send(data, { targetPeer });
        });
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new ConversationalAgent(absConfigPath);
    app.start();
}
