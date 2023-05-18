const wav = require("wav");
const { ServiceController } = require("ubiq-genie-components");

class SpeechToTextService extends ServiceController {
    constructor(scene, config = {}) {
        super(scene, "SpeechToTextService", config);
        this.registerRoomClientEvents();
    }

    // Register events to create a transcription process for each peer. These processes are killed when the peer leaves the room.
    registerRoomClientEvents() {
        if (this.roomClient == undefined) {
            throw "RoomClient must be added to the scene before AudioCollector";
        }

        this.roomClient.addListener(
            "OnPeerAdded",
            function (peer) {
                this.registerChildProcess(peer.uuid, "python", [
                    "-u",
                    "../../services/speech_to_text/transcribe_azure.py",
                    "--key",
                    this.config.credentials.azureSpeech.key,
                    "--region",
                    this.config.credentials.azureSpeech.region,
                ]);
            }.bind(this)
        );

        this.roomClient.addListener(
            "OnPeerRemoved",
            function (peer) {
                if (this.writeOutputToFile) {
                    this.writer.end();
                }
                console.log("Ending speech-to-text process for peer " + peer.uuid);
                this.killChildProcess(peer.uuid);
            }.bind(this)
        );
    }
}

module.exports = {
    SpeechToTextService,
};
