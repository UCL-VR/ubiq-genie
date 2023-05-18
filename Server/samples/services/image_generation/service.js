const { ServiceController } = require("ubiq-genie-components");

class ImageGenerationService extends ServiceController {
    constructor(scene, config = {}) {
        super(scene, "ImageGenerationService", config)

        this.registerRoomClientEvents();
    }

    // Register events to start the child process when the first peer joins the room, and to kill the child process when the last peer leaves the room.
    registerRoomClientEvents() {
        if (this.roomClient == undefined) {
            throw "RoomClient must be added to the scene before ImageGenerationService";
        }

        this.roomClient.addListener(
            "OnPeerAdded",
            function (peer) {
                if (!("default" in this.childProcesses)) {
                    this.registerChildProcess("default", "python", [
                        "-u",
                        "../../services/image_generation/text_2_image.py",
                        "--output_folder",
                        "../../apps/texture_generation/data",
                        "--prompt_postfix",
                        ", 4k"
                    ]);
                }
            }.bind(this)
        );

        this.roomClient.addListener(
            "OnPeerRemoved",
            function (peer) {
                if (this.roomClient.peers.size == 0) {
                    this.killChildProcess("default");
                }
            }.bind(this)
        );
    }
}

module.exports = {
    ImageGenerationService,
};
