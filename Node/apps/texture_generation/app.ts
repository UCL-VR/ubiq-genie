import { NetworkId } from 'ubiq-server/ubiq';
import { ApplicationController } from '../../components/application';
import { MessageReader } from '../../components/message_reader';
import { ImageGenerationService } from '../../services/image_generation/service';
import { SpeechToTextService } from '../../services/speech_to_text/service';
import { FileServer } from '../../components/file_server';
import path from 'path';
import { RTCAudioData } from '@roamhq/wrtc/types/nonstandard';
import { MediaReceiver } from '../../components/media_receiver';
import { fileURLToPath } from 'url';

class TextureGeneration extends ApplicationController {
    lastPeerSelection: {
        [key: string]: { time: number; message: string; triggerHeld: boolean; triggerReleased: boolean };
    } = { 0: { time: 0, message: '', triggerHeld: false, triggerReleased: false } };
    commandRegex: RegExp =
        /(?:transform|create|make|set|change|turn)(?: the| an| some)? (?:(?:(.*?)?(?:(?: to| into| seem| look| appear|))?(?: like|like a|like an| a)? (.*)))/i;
    textureTarget?: { [key: string]: string };

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
        // A FileServer to serve image files to clients
        this.components.fileServer = new FileServer('data');

        // An MediaReceiver to receive audio data from peers
        this.components.mediaReceiver = new MediaReceiver(this.scene);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.speech2text = new SpeechToTextService(this.scene);

        // An ImageGenerationService to generate images based on text
        this.components.textureGeneration = new ImageGenerationService(this.scene);

        // A MessageReader to receive selection data from peers based on fixed network ID
        // Selection data is stored in a dictionary, where the key is the peer UUID and the value is target object
        this.components.selectionReceiver = new MessageReader(this.scene, 97);
        this.lastPeerSelection = {};
        this.textureTarget = {};
    }

    definePipeline() {
        // Step 1: When we receive a selection from a peer, store it in a dictionary for later use
        this.components.selectionReceiver.on('data', (data: any) => {
            const selectionData = JSON.parse(data.message.toString());
            const peerUUID = selectionData.peer;
            const selection = selectionData.selection;
            const triggerHeld = selectionData.triggerHeld; // True when trigger is held
            const triggerReleased =
                this.lastPeerSelection[peerUUID] &&
                this.lastPeerSelection[peerUUID].triggerHeld &&
                triggerHeld === false;

            this.lastPeerSelection[peerUUID] = {
                time: new Date().getTime(),
                message: selection,
                triggerHeld: triggerHeld,
                triggerReleased: triggerReleased,
            };

            // console.log(this.lastPeerSelection[peerUUID]);
        });

        // Step 2: When we receive audio data from a peer, we send it to the transcription service
        this.components.mediaReceiver?.on('audio', (uuid: string, data: RTCAudioData) => {
            // Convert the Int16Array to a Buffer
            const sampleBuffer = Buffer.from(data.samples.buffer);

            // We only send the audio data to the transcription service if the trigger is held or released
            if (this.lastPeerSelection[uuid]) {
                if (this.lastPeerSelection[uuid].triggerHeld) {
                    this.components.speech2text?.sendToChildProcess(uuid, sampleBuffer);
                } else if (this.lastPeerSelection[uuid].triggerReleased) {
                    this.components.speech2text?.sendToChildProcess(uuid, sampleBuffer);
                    this.lastPeerSelection[uuid].triggerReleased = false;
                }
            }
        });

        // Step 3: When we receive a transcription from the transcription service, send it to the image generation service
        this.components.speech2text?.on('data', (data: Buffer, identifier: string) => {
            // If data starts with "> ", it is a transcription result. Otherwise, it is a status message.
            if (data.toString().startsWith('>')) {
                // Strip off > and ensure there is only a single newline at the end
                const transcription = data.toString().substring(1).replace(/\n+$/, '\n');
                const commandMatch = this.commandRegex.exec(transcription);
                if (commandMatch != null) {
                    if (commandMatch[1] && commandMatch[2]) {
                        console.log(
                            '\x1b[32mRecognized command\x1b[0m: ' +
                                transcription
                                    .replace(commandMatch[1], '\x1b[32m' + commandMatch[1] + '\x1b[0m')
                                    .replace(commandMatch[2], '\x1b[32m' + commandMatch[2] + '\x1b[0m')
                        );
                        let textureTarget = commandMatch[1];

                        // Check if texture target is "this" or "that" or "all of these" or "all of those"
                        if (textureTarget.toLowerCase() == 'this' || textureTarget.toLowerCase() == 'that') {
                            // If so, we need to retrieve the last selected object by the peer in lastPeerSelection, if it was within the last 10 seconds
                            const time = new Date().getTime();
                            if (
                                this.lastPeerSelection[identifier] &&
                                time - this.lastPeerSelection[identifier].time < 10000
                            ) {
                                textureTarget = this.lastPeerSelection[identifier].message;
                                console.log('Changing ray-based texture target to: ' + textureTarget);
                            } else {
                                console.log(
                                    '\x1b[33m' +
                                        'No object selected by peer ' +
                                        identifier +
                                        ' in the last 10 seconds, so cannot change texture target' +
                                        '\x1b[0m'
                                );
                            }
                        }

                        this.scene.send(new NetworkId(97), {
                            type: 'GenerationStarted',
                            target: textureTarget,
                            data: '',
                            peer: identifier,
                        });

                        // If command contains the word texture or pattern, add a suffix to the command to make it more specific
                        if (
                            commandMatch[2].toLowerCase().includes('texture') ||
                            commandMatch[2].toLowerCase().includes('pattern')
                        ) {
                            commandMatch[2] += ', seamless, flat texture, video game texture';
                        }

                        // Create target file name based on peer uuid, target object, and current time
                        const time = new Date().getTime();
                        const targetFileName = identifier + '_' + textureTarget + '_' + time;

                        this.components.textureGeneration.sendToChildProcess(
                            'default',
                            JSON.stringify({
                                prompt: commandMatch[2],
                                output_file: targetFileName,
                            }) + '\n'
                        );
                        console.log(
                            'Sent message to texture generation service: {prompt: ' +
                                commandMatch[2] +
                                ', output_file: ' +
                                targetFileName +
                                '}'
                        );
                    } else {
                        this.log('\x1b[33m' + 'Unrecognized command: ' + transcription + '\x1b[0m');
                    }
                }
            } else {
                this.log('Child process ' + identifier + ' sent status message: ' + data.toString());
            }
        });

        // Step 4: When we receive a response from the image generation service, send a message to clients with the image file name.
        this.components.textureGeneration.on('data', (data: Buffer, identifier: string) => {
            const dataString = data.toString();
            if (dataString.includes('.png')) {
                const [peerUUID, target, time] = dataString.split('_');
                this.scene.send(new NetworkId(97), {
                    type: 'TextureGeneration',
                    target: target,
                    data: dataString,
                    peer: peerUUID,
                });
            }
        });
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new TextureGeneration(absConfigPath);
    app.start();
}

export { TextureGeneration };
