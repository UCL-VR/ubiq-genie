import os
import sys
import azure.cognitiveservices.speech as speechsdk
from azure.cognitiveservices.speech.audio import AudioStreamFormat, AudioConfig

def recognize_from_stdin():
    speech_config = speechsdk.SpeechConfig(
        subscription=os.environ.get("SPEECH_KEY"),
        region=os.environ.get("SPEECH_REGION"),
    )
    speech_config.speech_recognition_language = "en-US"
    audio_format = AudioStreamFormat(48000, 16, 1)
    custom_push_stream = speechsdk.audio.PushAudioInputStream(stream_format=audio_format)
    audio_config = AudioConfig(stream=custom_push_stream)

    speech_recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config, audio_config=audio_config
    )
    done = False

    def recognized_cb(evt: speechsdk.SpeechRecognitionEventArgs):
        print(">{}".format(evt.result.text))

    def stop_cb(evt: speechsdk.SessionEventArgs):
        """callback that signals to stop continuous recognition"""
        print("CLOSING on {}".format(evt))
        nonlocal done
        done = True

    speech_recognizer.recognized.connect(recognized_cb)
    speech_recognizer.session_stopped.connect(stop_cb)
    speech_recognizer.canceled.connect(stop_cb)

    result_future = speech_recognizer.start_continuous_recognition_async()
    result_future.get()

    # Signal readiness to the parent process (convention: >READY on stdout)
    print(">READY")
    sys.stdout.flush()

    while not done:
        try:
            data = sys.stdin.buffer.read(4096)
            if len(data) == 0:
                break
            custom_push_stream.write(data)
        except KeyboardInterrupt:
            break

def main():
    recognize_from_stdin()
    print("Azure Speech client stopped receiving chunks.")

if __name__ == "__main__":
    main()
