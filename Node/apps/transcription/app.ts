// import { UbiqTcpConnection } from 'ubiq-server/ubiq';
import { ApplicationController } from '../../components/application';
import { NetworkId } from 'ubiq-server/ubiq';
import { SpeechToTextService } from '../../services/speech_to_text/service';
import fs from 'fs';
import path from 'path';
import { MediaReceiver } from '../../components/media_receiver';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { AudioRecorder } from '../../services/audio_recorder/service';
import { fileURLToPath } from 'url';

class Transcription extends ApplicationController {
    components: {
        audioRecorder?: AudioRecorder;
        mediaReceiver?: MediaReceiver;
        speech2text?: SpeechToTextService;
        writer?: fs.WriteStream;
    } = {};

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

    registerComponents(): void {
        // An MediaReceiver to receive audio data from peers
        this.components.mediaReceiver = new MediaReceiver(this.scene);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.speech2text = new SpeechToTextService(this.scene);

        // An AudioRecorder to record audio data from peers
        this.components.audioRecorder = new AudioRecorder(this.scene);

        // File path based on peer UUID and timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-');

        // Create ./recordings directory if it does not exist
        if (!fs.existsSync('./recordings')) {
            fs.mkdirSync('./recordings');
        }

        // Define file writer to write transcription output to a file
        this.components.writer = fs.createWriteStream('./recordings/transcription_timestamp_' + timestamp + '.csv');

        // Write header to the file
        this.components.writer.write('Timestamp,Peer,Transcription\n');
    }

    definePipeline(): void {
        // Step 1: When we receive audio data from a peer we send it to the transcription service and recording service
        this.components.mediaReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            // Convert the Int16Array to a Buffer
            const sampleBuffer = Buffer.from(data.samples.buffer);

            // Send the audio data to the transcription service and the audio recording service
            if (this.roomClient.peers.get(uuid) !== undefined) {
                this.components.speech2text?.sendToChildProcess(uuid, sampleBuffer);
                this.components.audioRecorder?.sendToChildProcess(uuid, sampleBuffer);
            }
        });

        // Step 2: When we receive a response from the transcription service, write it to a file. Also, send it to the client.
        this.components.speech2text?.on('data', (data: Buffer, identifier: string) => {
            // If data starts with "> ", it is a transcription result. Otherwise, it is a status message.
            if (data.toString().startsWith('>') && data.toString().length > 3) {
                // Strip off > and ensure there is only a single newline at the end
                const transcription = Buffer.from(data.toString().substring(1).replace(/\n+$/, '\n'));

                // Write the transcription to a file
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                this.components.writer?.write(timestamp + ',' + identifier + ',' + transcription);
                this.log('[' + timestamp + '] ' + identifier + ': ' + transcription, 'info', '');

                // Send the transcription result to the client based on a predefined networkId
                this.scene.send(new NetworkId(99), {
                    timestamp: timestamp,
                    peer: identifier,
                    data: transcription.toString(),
                });
            } else {
                this.log('Child process ' + identifier + ' sent status message: ' + data.toString());
            }
        });
    }
}

export { Transcription };

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new Transcription(absConfigPath);
    app.start();
}
