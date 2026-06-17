import { ApplicationController } from '../../../components/application';
import { TextToSpeechService } from '../../../services/text_to_speech/service';
import { SpeechToTextService } from '../../../services/speech_to_text/service';
import { TextGenerationService } from '../../../services/text_generation/service';
import { VoipReceiver } from '../../../components/voip_receiver';
import { AudioSender } from '../../../components/audio_sender';
import path from 'path';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { fileURLToPath } from 'url';

export class ConversationalAgentMultiModel extends ApplicationController {
    components: {
        voipReceiver?: VoipReceiver;
        speech2text?: SpeechToTextService;
        textGenerationService?: TextGenerationService;
        textToSpeechService?: TextToSpeechService;
    } = {};

    /** Shared sender that handles AudioInfo headers + chunked PCM protocol. */
    private audioSender!: AudioSender;

    targetPeerQueue: string[] = [];

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
        this.components.speech2text = new SpeechToTextService(this.scene);
        this.components.textGenerationService = new TextGenerationService(this.scene);
        this.components.textToSpeechService = new TextToSpeechService(this.scene);
        this.log('Using multi-model STT → text generation → TTS pipeline');
    }

    definePipeline() {
        this.components.voipReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            const sampleBuffer = Buffer.from(
                data.samples.buffer,
                data.samples.byteOffset,
                data.samples.byteLength,
            );

            if (this.roomClient.peers.get(uuid) !== undefined) {
                this.components.speech2text?.sendToChildProcess(uuid, sampleBuffer);
            }
        });

        this.components.speech2text?.on('data', (data: Buffer, identifier: string) => {
            const peer = this.roomClient.peers.get(identifier);
            const peerName = peer?.properties.get('ubiq.displayname');

            let response = data.toString();
            response = response.replace(/(\r\n|\n|\r)/gm, '');

            if (response.startsWith('>')) {
                response = response.slice(1);
                if (response.trim()) {
                    const message = (peerName + ' -> Agent:: ' + response).trim();
                    this.log(message);

                    this.components.textGenerationService?.sendToChildProcess('default', message + '\n');
                }
            }
        });

        this.components.textGenerationService?.on('data', (data: Buffer, identifier: string) => {
            const response = data.toString();
            this.log('Received text generation response from child process ' + identifier + ': ' + response, 'info');

            // Parse target peer from the response (Agent -> TargetPeer:: Message)
            const [, name, message] = response.match(/-> (.*?):: (.*)/) || [];

            if (!name || !message) {
                this.log('Error parsing target peer and message', 'error');
                return;
            }

            this.targetPeerQueue.push(name.trim());
            this.components.textToSpeechService?.sendToChildProcess('default', message.trim() + '\n');
        });

        this.components.textToSpeechService?.on('data', (data: Buffer, _identifier: string) => {
            const targetPeer = this.targetPeerQueue.shift() ?? '';
            this.audioSender.send(data, { targetPeer });
        });
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new ConversationalAgentMultiModel(absConfigPath);
    app.start();
}
