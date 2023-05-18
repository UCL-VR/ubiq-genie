const { FileServer } = require("./file_server/service")
const { ImageGenerationService } = require("./image_generation/service")
const { SpeechToTextService } = require("./speech_to_text/service")
const { TextToSpeechService } = require("./text_to_speech/service")
const { TextGenerationService } = require("./text_generation/service")

module.exports = {
    FileServer,
    ImageGenerationService,
    SpeechToTextService,
    TextToSpeechService,
    TextGenerationService
}