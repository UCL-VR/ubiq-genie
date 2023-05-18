import sys
import json
import argparse
import io
import speech_recognition as sr
from datetime import datetime, timedelta
from queue import Queue
from tempfile import NamedTemporaryFile
from time import sleep
from sys import platform
from threading import Thread, Lock
import torch
import whisper

parser = argparse.ArgumentParser()
parser.add_argument(
    "--model",
    default="tiny",
    help="Model to use",
    choices=["tiny", "base", "small", "medium", "large"],
)
parser.add_argument(
    "--dry_run", default=False, action="store_true", help="Launched from console."
)
parser.add_argument(
    "--non_english",
    default=False,
    action="store_true",
    help="Don't use the english model.",
)
parser.add_argument(
    "--energy_threshold", default=1000, help="Energy level for mic to detect.", type=int
)
parser.add_argument(
    "--record_timeout",
    default=2,
    help="How real time the recording is in seconds.",
    type=float,
)
parser.add_argument(
    "--phrase_timeout",
    default=3,
    help="How much empty space between recordings before we consider it a new line in the transcription.",
    type=float,
)
args = parser.parse_args()


def recognize_from_stdin():
    # The last time a recording was retreived from the queue.
    phrase_time = None
    # Current raw audio bytes.
    last_sample = bytes()
    # Thread safe Queue for passing data from the threaded recording callback.
    data_queue = Queue()
    record_timeout = args.record_timeout
    phrase_timeout = args.phrase_timeout

    # Load / Download model
    model = args.model
    if args.model != "large" and not args.non_english:
        model = model + ".en"
    audio_model = whisper.load_model(model)

    temp_file = NamedTemporaryFile().name

    lock = Lock()
    # Cue the user that we're ready to go.
    print("Model loaded.\n")

    if args.dry_run == True:
        print("Test Mode")
        # We use SpeechRecognizer to record our audio because it has a nice feauture where it can detect when speech ends.
        recorder = sr.Recognizer()
        recorder.energy_threshold = args.energy_threshold
        # Definitely do this, dynamic energy compensation lowers the energy threshold dramtically to a point where the SpeechRecognizer never stops recording.
        recorder.dynamic_energy_threshold = False
        if "linux" in platform:
            parser.add_argument(
                "--default_microphone",
                default="pulse",
                help="Default microphone name for SpeechRecognition. "
                "Run this with 'list' to view available Microphones.",
                type=str,
            )

        # Important for linux users.
        # Prevents permanent application hang and crash by using the wrong Microphone
        if "linux" in platform:
            mic_name = args.default_microphone
            if not mic_name or mic_name == "list":
                print("Available microphone devices are: ")
                for index, name in enumerate(sr.Microphone.list_microphone_names()):
                    print(f'Microphone with name "{name}" found')
                return
            else:
                for index, name in enumerate(sr.Microphone.list_microphone_names()):
                    if mic_name in name:
                        source = sr.Microphone(sample_rate=16000, device_index=index)
                        break
        else:
            source = sr.Microphone(sample_rate=16000)
        with source:
            recorder.adjust_for_ambient_noise(source)

        def record_callback(_, audio: sr.AudioData) -> None:
            """
            Threaded callback function to recieve audio data when recordings finish.
            audio: An AudioData containing the recorded bytes.
            """
            # Grab the raw bytes and push it into the thread safe queue.
            data = audio.get_raw_data()
            data_queue.put(data)

        # Create a background thread that will pass us raw audio bytes.
        # We could do this manually but SpeechRecognizer provides a nice helper.
        recorder.listen_in_background(
            source, record_callback, phrase_time_limit=record_timeout
        )

    else:
        print("Ubiq Mode")

        def producer(queue):
            while True:
                try:
                    line = sys.stdin.buffer.readline()
                    data = bytes(json.loads(line)["data"])
                    if len(data) == 0:
                        break
                    with lock:
                        data_queue.put(data)
                except KeyboardInterrupt:
                    break

        producer = Thread(target=producer, args=(data_queue,))
        producer.start()

    done = False

    previous = None
    while not done:
        try:
            now = datetime.utcnow()
            # Pull raw recorded audio from the queue.
            empty = data_queue.empty()
            if not empty:
                phrase_complete = False
                # If enough time has passed between recordings, consider the phrase complete.
                # Clear the current working audio buffer to start over with the new data.
                if phrase_time and now - phrase_time > timedelta(
                    seconds=phrase_timeout
                ):
                    last_sample = bytes()
                    phrase_complete = True
                # This is the last time we received new audio data from the queue.
                phrase_time = now

                # Concatenate our current audio data with the latest audio data.
                while not data_queue.empty():
                    with lock:
                        data = data_queue.get()
                    last_sample += data

                # Use AudioData to convert the raw data to wav data.
                audio_data = sr.AudioData(
                    last_sample, 16000, 2
                )  # source.SAMPLE_RATE=16000 , source.SAMPLE_WIDTH = 2
                wav_data = io.BytesIO(audio_data.get_wav_data())

                # Write wav data to the temporary file as bytes.
                with open(temp_file, "w+b") as f:
                    f.write(wav_data.read())

                # Read the transcription.
                result = audio_model.transcribe(
                    temp_file, fp16=torch.cuda.is_available()
                )
                print(result)
                text = result["text"].strip()

                print(">{}".format(text))
                # Infinite loops are bad for processors, must sleep.
                sleep(0.25)

        except KeyboardInterrupt:
            if "producer" in locals():
                producer.join()
            break


recognize_from_stdin()
print("Whisper Speech client stopped receiving chunks.")
