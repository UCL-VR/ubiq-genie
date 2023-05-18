const { NetworkId } = require("ubiq/ubiq/messaging");
const { MessageReader, ApplicationController } = require("ubiq-genie-components");
const { TextToSpeechService, TextGenerationService, SpeechToTextService } = require("ubiq-genie-services");
const fs = require("fs");
const nconf = require("nconf");

class ConversationalAgent extends ApplicationController {
    constructor(configFile = "config.json") {
        super(configFile);
    }

    registerComponents() {
        // A MessageReader to read audio data from peers based on fixed network ID
        this.components.audioReceiver = new MessageReader(this.scene, 98);

        // A SpeechToTextService to transcribe audio coming from peers
        this.components.transcriptionService = new SpeechToTextService(this.scene, nconf.get());

        // A TextGenerationService to generate text based on text
        this.components.textGenerationService = new TextGenerationService(this.scene, nconf.get());

        this.components.textToSpeechService = new TextToSpeechService(this.scene, nconf.get());
    }

    definePipeline() {
        // Step 1: When we receive audio data from a peer, split it into a peer UUID and audio data, and send it to the transcription service
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

        // Step 2: When we receive a transcription from the transcription service, send it to the image generation service
        this.components.transcriptionService.on("response", (data, identifier) => {
            // roomClient.peers is a Map of all peers in the room
            // Get the peer with the given identifier
            const peer = this.roomClient.peers.get(identifier);
            const peerName = peer.properties.get("ubiq.samples.social.name");

            var response = data.toString();

            // Remove all newlines from the response
            response = response.replace(/(\r\n|\n|\r)/gm, "");
            if (response.startsWith(">")) {
                response = response.slice(1); // Slice off the leading '>' character
                if (response.trim()) {
                    console.log(peerName + " -> Agent:: " + response);

                    // this.components.textToSpeechService.sendToChildProcess("default", response + "\n");
                    this.components.textGenerationService.sendToChildProcess("default", response + "\n");
                }
            }
        });

        // Step 3: When we receive a response from the text generation service, send it to the text to speech service
        this.components.textGenerationService.on("response", (data, identifier) => {
            var response = data;
            console.log("Received text generation response from child process " + identifier);

            this.components.textToSpeechService.sendToChildProcess("default", response + "\n");
        });

        this.components.textToSpeechService.on("response", (data, identifier) => {
            var response = data;
            console.log("Received TTS response from child process " + identifier);

            this.scene.send(95, {
                type: "AudioInfo",
                targetPeer: "Blue Hawk",
                audioLength: data.length,
            });

            while (response.length > 0) {
                // console.log("Sending audio data to peers. Audio data length: " + this.audioData.length + " bytes");
                this.scene.send(95, response.slice(0, 16000));
                response = response.slice(16000);
                console.log("Sent audio data to peers. Audio data length: " + response.length + " bytes");
            }
        });
    }
}

module.exports = { ConversationalAgent };

if (require.main === module) {
    const app = new ConversationalAgent();
    app.start();
}
