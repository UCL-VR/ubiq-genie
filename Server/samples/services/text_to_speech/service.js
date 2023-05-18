const { ServiceController } = require("ubiq-genie-components");

class TextToSpeechService extends ServiceController {
    constructor(scene, config = {}) {
        super(scene, "TextToSpeechService", config);

        this.registerChildProcess("default", "python", [
            "-u",
            "../../services/text_to_speech/text_to_speech_azure.py",
        ]);
        
        console.log("Registered TextToSpeechService");
    }
}

module.exports = {
    TextToSpeechService,
};
