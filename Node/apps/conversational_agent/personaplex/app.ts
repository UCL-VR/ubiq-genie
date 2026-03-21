import { ApplicationController } from '../../../components/application';
import { AudioToAudioService } from '../../../services/audio_to_audio/service';
import { VoipReceiver } from '../../../components/voip_receiver';
import { AudioSender } from '../../../components/audio_sender';
import {
    encodePacket,
    LengthPrefixedParser,
    KIND_HANDSHAKE,
    KIND_AUDIO,
    KIND_TEXT,
    KIND_ERROR,
    downsample48kTo24k,
    upsample24kTo48k,
} from '../../../services/audio_to_audio/providers/personaplex/index';
import path from 'path';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { fileURLToPath } from 'url';

export class ConversationalAgentPersonaPlex extends ApplicationController {
    components: {
        voipReceiver?: VoipReceiver;
        audioToAudioService?: AudioToAudioService;
    } = {};

    /** Shared sender that handles AudioInfo headers + chunked PCM protocol. */
    private audioSender!: AudioSender;

    /** Tracks the UUID of the peer that most recently sent audio. */
    private lastAudioSenderUuid: string = '';

    /** Parser instance for decoding PersonaPlex stdout framing. */
    private stdoutParser: LengthPrefixedParser = new LengthPrefixedParser();

    constructor(configFile: string = 'config.json') {
        super(configFile);
    }

    start(): void {
        this.registerComponents();
        this.log(`Services registered: ${Object.keys(this.components).join(', ')}`);

        this.definePipeline();
        this.log('Pipeline defined');

        this.joinRoom();
    }

    registerComponents() {
        this.audioSender = new AudioSender(this.scene, 95, 48000);
        this.components.voipReceiver = new VoipReceiver(this.scene);
        this.components.audioToAudioService = new AudioToAudioService(this.scene);
        this.log('Using PersonaPlex audio-to-audio pipeline');
    }

    definePipeline() {
        const service = this.components.audioToAudioService!;

        /** Whether the initial AudioInfo header has been sent for this stream. */
        let streamStarted = false;

        this.components.voipReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            if (this.roomClient.peers.get(uuid) === undefined) {
                return;
            }

            // Don't send audio to the model before it's ready — it would pile
            // up in the OS pipe buffer and create a stale backlog.
            if (service.state !== 'ready' && service.state !== 'idle') {
                return;
            }

            this.lastAudioSenderUuid = uuid;

            const sampleBuffer = Buffer.from(
                data.samples.buffer,
                data.samples.byteOffset,
                data.samples.byteLength,
            );
            const downsampled = downsample48kTo24k(sampleBuffer);
            const packet = encodePacket(KIND_AUDIO, downsampled);

            service.sendToChildProcess('default', packet);
        });

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
                        service.setReady();
                        this.log('PersonaPlex handshake received — model is ready');
                        break;

                    case KIND_AUDIO: {
                        const upsampled = upsample24kTo48k(packet.payload);

                        // Send one AudioInfo at stream start so Unity knows the
                        // sample rate and target peer. After that, send only raw
                        // PCM chunks — no new headers that would clear the queue.
                        if (!streamStarted) {
                            const targetPeerObj = this.roomClient.peers.get(this.lastAudioSenderUuid);
                            const targetPeer = targetPeerObj?.properties.get('ubiq.displayname') ?? '';
                            this.audioSender.sendHeader({ targetPeer });
                            streamStarted = true;
                        }

                        this.audioSender.sendChunks(upsampled);
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
            streamStarted = false;
            this.flushStream();
            this.log(`PersonaPlex process ${identifier} exited (code=${code}, signal=${signal})`, 'warning');
            this.stdoutParser.reset();
        });
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new ConversationalAgentPersonaPlex(absConfigPath);
    app.start();
}
