import time
import sys

def main():
    while True:
        # ServiceController forwards stdout line-by-line, so each message
        # must end with a newline to be emitted to the app pipeline.
        print("Hello world!")
        sys.stdout.flush()  # Ensure the output is flushed immediately
        time.sleep(5)  # Send data every 5 seconds

if __name__ == "__main__":
    main()
