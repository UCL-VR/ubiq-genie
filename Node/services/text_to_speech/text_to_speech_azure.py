import os
import sys
import azure.cognitiveservices.speech as speechsdk
import wave

def initialize_speech_synthesizer():
    speech_config = speechsdk.SpeechConfig(
        subscription=os.environ.get('SPEECH_KEY'), 
        region=os.environ.get('SPEECH_REGION')
    )
    speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm)
    speech_config.speech_synthesis_voice_name = 'en-US-GuyNeural'
    return speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

def transcribe_speech(text, speech_synthesizer):
    speech_synthesis_result = speech_synthesizer.speak_text_async(text).get()
    sys.stdout.buffer.write(speech_synthesis_result.audio_data)

    with wave.open("output.wav", 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        
        wf.writeframes(speech_synthesis_result.audio_data)

    if speech_synthesis_result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = speech_synthesis_result.cancellation_details
        print("Speech synthesis canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speechsdk.CancellationReason.Error and cancellation_details.error_details:
            print("Error details: {}".format(cancellation_details.error_details))
            print("Did you set the speech resource key and region values?")

def main():
    speech_synthesizer = initialize_speech_synthesizer()

    while True:
        try:
            text = input()
            if text.strip():
                transcribe_speech(text, speech_synthesizer)
        except KeyboardInterrupt:
            print("Speech synthesis stopped.")
            break

if __name__ == "__main__":
    main()