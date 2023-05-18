const { ServiceController } = require("ubiq-genie-components");

class TextGenerationService extends ServiceController {
    constructor(scene, config = {}) {
        super(scene, "TextGenerationService", config);

        this.registerChildProcess("default", "python", [
            "-u",
            "../../services/text_generation/openai_chatgpt.py",
            "--preprompt",
            config.preprompt,
            "--prompt_suffix",
            config.prompt_suffix,
            "--key",
            config.key
        ]);
    }
}

module.exports = {
    TextGenerationService,
};
