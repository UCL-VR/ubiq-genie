import os
import sys
import json
import azure.cognitiveservices.speech as speechsdk
from azure.cognitiveservices.speech.audio import AudioStreamFormat, AudioConfig
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--peer", type=str, default="00000000-0000-0000-0000-000000000000")
parser.add_argument("--key", type=str, required=True) # Required API key parameter for Azure Speech
parser.add_argument("--region", type=str, required=True) # Required region parameter for Azure Speech
args = parser.parse_args()

def recognize_from_stdin():
    speech_config = speechsdk.SpeechConfig(
        subscription=args.key,
        region=args.region,
    )
    speech_config.speech_recognition_language = "en-US"
    audioFormat = AudioStreamFormat(16000, 16, 1)
    custom_push_stream = speechsdk.audio.PushAudioInputStream(stream_format=audioFormat)
    audio_config = AudioConfig(stream=custom_push_stream)

    speech_recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config, audio_config=audio_config
    )
    done = False

    # def recognizing_cb(evt: speechsdk.SpeechRecognitionEventArgs):
    #     print("RECOGNIZING: {}".format(evt))

    def recognized_cb(evt: speechsdk.SpeechRecognitionEventArgs):
        print(">{}".format(evt.result.text))

    def stop_cb(evt: speechsdk.SessionEventArgs):
        """callback that signals to stop continuous recognition"""
        print("CLOSING on {}".format(evt))
        nonlocal done
        done = True

    # Connect callbacks to the events fired by the speech recognizer
    # speech_recognizer.recognizing.connect(recognizing_cb)
    speech_recognizer.recognized.connect(recognized_cb)
    speech_recognizer.session_stopped.connect(stop_cb)
    speech_recognizer.canceled.connect(stop_cb)

    # Perform recognition. `start_continuous_recognition_async asynchronously initiates continuous recognition operation,
    # Other tasks can be performed on this thread while recognition starts...
    # wait on result_future.get() to know when initialization is done.
    # Call stop_continuous_recognition_async() to stop recognition.
    result_future = speech_recognizer.start_continuous_recognition_async()

    result_future.get()  # wait for voidfuture, so we know engine initialization is done.

    # Write stdin to the stream
    while not done:
        try:
            line = sys.stdin.buffer.readline()
            data = bytes(json.loads(line)["data"])
            if len(data) == 0:
                break
            custom_push_stream.write(data)
        except KeyboardInterrupt:
            break


recognize_from_stdin()
print("Azure Speech client stopped receiving chunks.")
