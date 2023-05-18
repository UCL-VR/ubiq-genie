const { NetworkId } = require("ubiq/ubiq/messaging");
const { MessageReader, ApplicationController } = require("ubiq-genie-components");
const { ImageGenerationService, SpeechToTextService, FileServer } = require("ubiq-genie-services");
const nconf = require("nconf");

class TextureGeneration extends ApplicationController {
    constructor(configFile = "config.json") {
        super(configFile);
    }

    registerComponents() {
        // A FileServer to serve image files to clients
        this.components.fileServer = new FileServer("data");

        // A MessageReader to read audio data from peers based on fixed network ID
        this.components.audioReceiver = new MessageReader(this.scene, 98);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.transcriptionService = new SpeechToTextService(this.scene, nconf.get());

        // An ImageGenerationService to generate images based on text
        this.components.textureGeneration = new ImageGenerationService(this.scene);

        // A MessageReader to receive selection data from peers based on fixed network ID
        // Selection data is stored in a dictionary, where the key is the peer UUID and the value is target object
        this.components.selectionReceiver = new MessageReader(this.scene, 93);
        this.lastPeerSelection = {};

        this.commandRegex =
            /(?:transform|create|make|set|change|turn)(?: the| an| some)? (?:(?:(.*?)?(?:(?: to| into| seem| look| appear|))?(?: like|like a|like an| a)? (.*)))/i;
        this.textureTarget = {};
    }

    definePipeline() {
        // Step 1: When we receive a selection from a peer, store it in a dictionary for later use
        this.components.selectionReceiver.on("data", (data) => {
            // Split the data into a peer_uuid (36 bytes) and the string containg the selection (rest)
            const peerUUID = data.message.subarray(0, 36).toString();
            const objectMaterial = data.message.subarray(36, data.message.length).toString();

            lastPeerSelection[peerUUID] = {
                time: new Date().getTime(),
                message: objectMaterial,
            };
        });

        // Step 2: When we receive audio data from a peer, split it into a peer UUID and audio data, and send it to the transcription service
        this.components.audioReceiver.on("data", (data) => {
            // Split the data into a peer_uuid (36 bytes) and audio data (rest)
            const peerUUID = data.message.subarray(0, 36).toString();
            const audio_data = data.message.subarray(36, data.message.length);

            // Send the audio data to the transcription service
            this.components.transcriptionService.sendToChildProcess(
                peerUUID,
                JSON.stringify(audio_data.toJSON()) + "\n"
            );
        });

        // Step 3: When we receive a transcription from the transcription service, send it to the image generation service
        this.components.transcriptionService.on("response", (data, identifier) => {
            let response = data.toString();
            var peerUUID = identifier;
            if (response.startsWith(">")) {
                response = response.slice(1); // Slice off the leading '>' character
                let commandMatch = this.commandRegex.exec(response);
                if (commandMatch != null) {
                    if (commandMatch[1] && commandMatch[2]) {
                        console.log(
                            "\x1b[32mRecognized command\x1b[0m: " +
                                response
                                    .replace(commandMatch[1], "\x1b[32m" + commandMatch[1] + "\x1b[0m")
                                    .replace(commandMatch[2], "\x1b[32m" + commandMatch[2] + "\x1b[0m")
                        );
                        let textureTarget = commandMatch[1];

                        // Check if texture target is "this" or "that" or "all of these" or "all of those"
                        if (textureTarget.toLowerCase() == "this" || textureTarget.toLowerCase() == "that") {
                            // If so, we need to retrieve the last selected object by the peer in lastPeerSelection, if it was within the last 10 seconds
                            const time = new Date().getTime();
                            if (lastPeerSelection[peerUUID] && time - lastPeerSelection[peerUUID].time < 10000) {
                                textureTarget = lastPeerSelection[peerUUID].message;
                                console.log("Changing ray-based texture target to: " + textureTarget);
                            } else {
                                console.log(
                                    "\x1b[33m" +
                                        "No object selected by peer " +
                                        peerUUID +
                                        " in the last 10 seconds, so cannot change texture target" +
                                        "\x1b[0m"
                                );
                            }
                        }

                        this.scene.send(new NetworkId(97), {
                            type: "GenerationStarted",
                            target: textureTarget,
                            data: "",
                            peer: peerUUID,
                        });

                        // If command contains the word texture or pattern, add a suffix to the command to make it more specific
                        if (
                            commandMatch[2].toLowerCase().includes("texture") ||
                            commandMatch[2].toLowerCase().includes("pattern")
                        ) {
                            commandMatch[2] += ", seamless, flat texture, video game texture";
                        }
                        // Create target file name based on peer uuid, target object, and current time
                        const time = new Date().getTime();
                        const targetFileName = peerUUID + "_" + textureTarget + "_" + time;

                        this.components.textureGeneration.sendToChildProcess(
                            "default",
                            JSON.stringify({
                                prompt: commandMatch[2],
                                output_file: targetFileName,
                            }) + "\n"
                        );
                    }
                }
            }
        });

        // Step 4: When we receive a response from the image generation service, send a message to clients with the image file name.
        this.components.textureGeneration.on("response", (data, identifier) => {
            data = data.toString();
            if (data.includes(".png")) {
                const [peerUUID, target, time] = data.split("_");
                this.scene.send(new NetworkId(nconf.get("outputNetworkId")), {
                    type: "TextureGeneration",
                    target: target,
                    data: data,
                    peer: peerUUID,
                });
            }
        });

        this.components.textureGeneration.on("error", (err) => {
            console.log(err.toString());
        });
    }
}

module.exports = { TextureGeneration };

if (require.main === module) {
    const app = new TextureGeneration();
    app.start();
}
