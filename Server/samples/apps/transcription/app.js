const { NetworkId } = require("ubiq/ubiq/messaging");
const { MessageReader, ApplicationController } = require("ubiq-genie-components");
const { SpeechToTextService } = require("ubiq-genie-services");
const fs = require("fs");
const nconf = require("nconf");

class Transcription extends ApplicationController {
    constructor(configFile = "config.json") {
        super(configFile);
    }

    registerComponents() {
        // A MessageReader to read audio data from peers based on fixed network ID
        this.components.audioReceiver = new MessageReader(this.scene, 98);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.speech2text = new SpeechToTextService(this.scene, nconf.get());

        // Define file writer to write transcription output to a file
        this.components.writer = fs.createWriteStream("transcription.txt");
    }

    definePipeline() {
        // Step 1: When we receive audio data from a peer, split it into a peer UUID and audio data, and send it to the transcription service
        this.components.audioReceiver.on("data", (data) => {
            // Split the data into a peer_uuid (36 bytes) and audio data (rest)
            const peerUUID = data.message.subarray(0, 36).toString();
            const audioData = data.message.subarray(36, data.message.length);

            // Send the audio data to the transcription service
            this.components.speech2text.sendToChildProcess(peerUUID, JSON.stringify(audioData.toJSON()) + "\n");
        });

        // Step 2: When we receive a response from the transcription service, write it to a file. Also, send it to the client.
        this.components.speech2text.on("response", (data, identifier) => {
            // If data starts with "> ", it is a transcription result. Otherwise, it is a status message.
            if (data.toString().startsWith(">")) {
                this.components.writer.write(identifier + ": " + data.toString().substring(1));

                // Send the transcription result to the client based on a predefined networkId
                this.scene.send(new NetworkId(nconf.get("outputNetworkId")), {
                    type: "Transcription",
                    peer: identifier,
                    data: data.toString(),
                });
            } else {
                console.log("Child process " + identifier + " sent status message: " + data.toString());
            }
        });
    }
}

module.exports = { Transcription };

if (require.main === module) {
    const app = new Transcription();
    app.start();
}
