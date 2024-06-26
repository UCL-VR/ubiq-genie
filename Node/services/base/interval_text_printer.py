import time
import sys

def main():
    while True:
        print("Hello world!", end="")
        sys.stdout.flush()  # Ensure the output is flushed immediately
        time.sleep(5)  # Send data every 5 seconds

if __name__ == "__main__":
    main()