import os
import sys
import azure.cognitiveservices.speech as speechsdk

# This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
speech_config = speechsdk.SpeechConfig(subscription=os.environ.get('SPEECH_KEY'), region=os.environ.get('SPEECH_REGION'))
# Set the output format. The full list of supported format can be found here: https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/rest-text-to-speech#output-format. The default format is Riff16Khz16BitMonoPcm.
speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm)
speech_config.speech_synthesis_voice_name='en-US-GuyNeural'

speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

def transcribeSpeech(text):
    speech_synthesis_result = speech_synthesizer.speak_text_async(text).get()
    sys.stdout.buffer.write(speech_synthesis_result.audio_data)

    if speech_synthesis_result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = speech_synthesis_result.cancellation_details
        print("Speech synthesis canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            if cancellation_details.error_details:
                print("Error details: {}".format(cancellation_details.error_details))
                print("Did you set the speech resource key and region values?")

# Keep listening until the python process is killed
while True:
    text = input()
    transcribeSpeech(text)