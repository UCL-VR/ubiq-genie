import { NetworkId } from 'ubiq-server/ubiq';
import { ApplicationController } from '../../components/application';
import { TextToSpeechService } from '../../services/text_to_speech/service';
import { SpeechToTextService } from '../../services/speech_to_text/service';
import { TextGenerationService } from '../../services/text_generation/service';
import { MediaReceiver } from '../../components/media_receiver';
import path from 'path';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { fileURLToPath } from 'url';

export class ConversationalAgent extends ApplicationController {
    components: {
        mediaReceiver?: MediaReceiver;
        speech2text?: SpeechToTextService;
        textGenerationService?: TextGenerationService;
        textToSpeechService?: TextToSpeechService;
    } = {};
    targetPeer: string = '';
    constructor(configFile: string = 'config.json') {
        super(configFile);
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
        // An MediaReceiver to receive audio data from peers
        this.components.mediaReceiver = new MediaReceiver(this.scene);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.speech2text = new SpeechToTextService(this.scene);

        // A TextGenerationService to generate text based on text
        this.components.textGenerationService = new TextGenerationService(this.scene);

        // A TextToSpeechService to generate audio based on text
        this.components.textToSpeechService = new TextToSpeechService(this.scene);
    }

    definePipeline() {
        // Step 1: When we receive audio data from a peer we send it to the transcription service and recording service
        this.components.mediaReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            // Convert the Int16Array to a Buffer
            const sampleBuffer = Buffer.from(data.samples.buffer);


            // Send the audio data to the transcription service and the audio recording service
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

            this.targetPeer = name.trim();
            this.components.textToSpeechService?.sendToChildProcess('default', message.trim() + '\n');
        });

        this.components.textToSpeechService?.on('data', (data: Buffer, identifier: string) => {
            let response = data;

            this.scene.send(new NetworkId(95), {
                type: 'AudioInfo',
                targetPeer: this.targetPeer,
                audioLength: data.length,
            });

            while (response.length > 0) {
                this.scene.send(new NetworkId(95), response.slice(0, 16000));
                response = response.slice(16000);
            }
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
