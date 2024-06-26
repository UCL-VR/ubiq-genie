import os
import sys
import wave
import argparse

def write_to_wav(file_path, channels, sampwidth, framerate):
    # Open a new wave file
    with wave.open(file_path, 'wb') as wf:
        # Set the parameters for the WAV file
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(framerate)

        while True:
            try:
                data = sys.stdin.buffer.read(4096)  # Read in chunks of 4096 bytes
                if len(data) == 0:
                    break
                wf.writeframes(data)
            except KeyboardInterrupt:
                break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Record audio from stdin and save to a WAV file.")
    parser.add_argument("--file_path", type=str, default="received_audio.wav", help="Output WAV file path")
    parser.add_argument("--channels", type=int, default=1, help="Number of audio channels")
    parser.add_argument("--sampwidth", type=int, default=2, help="Sample width in bytes (e.g., 2 for 16-bit audio)")
    parser.add_argument("--framerate", type=int, default=48000, help="Frame rate in Hz (e.g., 48000 for 48kHz)")

    args = parser.parse_args()

    print("Recording audio...")
    write_to_wav(args.file_path, args.channels, args.sampwidth, args.framerate)
    print(f"Audio data written to {args.file_path}")
