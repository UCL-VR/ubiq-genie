import sys
import json
from google.cloud import speech


def read_stdin():
    readline = sys.stdin.readline()
    while readline:
        readline = bytes(json.loads(readline)["data"])
        yield readline
        readline = sys.stdin.readline()


read_stdin_gen = read_stdin()

config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=16000,
    language_code="en-US",
    audio_channel_count=1,
)
streaming_config = speech.StreamingRecognitionConfig(config=config)
client = speech.SpeechClient()
print("> Google Speech client ready to receive chunks")

requests = (
    speech.StreamingRecognizeRequest(audio_content=chunk) for chunk in read_stdin_gen
)

# streaming_recognize returns a generator.
for response in client.streaming_recognize(
    config=streaming_config,
    requests=requests,
):
    # Once the transcription has settled, the first result will contain the
    # is_final result. The other results will be for subsequent portions of
    # the audio.
    print("response")
    for result in response.results:
        print("Finished: {}".format(result.is_final))
        print("Stability: {}".format(result.stability))
        alternatives = result.alternatives
        # The alternatives are ordered from most likely to least.
        for alternative in alternatives:
            print("Confidence: {}".format(alternative.confidence))
            print("Transcript: {}".format(alternative.transcript))
