import json
import sys
import openai
import argparse


def request_response(message_log):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo", messages=message_log, max_tokens=1000, temperature=0.7
    )
    
    message_log.append(response.choices[0].message)
    return message_log


def listen_for_messages(args):
    message_log = [
        {"role": "system", "content": args.preprompt}
    ]

    while True:
        try:
            line = sys.stdin.buffer.readline()
            if len(line) == 0 or line.isspace():
                continue
            message_log.append(
                {"role": "user", "content": line.decode("utf-8").strip()}
            )
            request_response(message_log)
            print(">" + message_log[-1]["content"])
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preprompt", type=str, default="")
    parser.add_argument("--prompt_suffix", type=str, default="")
    parser.add_argument("--key", type=str, default="")
    args = parser.parse_args()

    openai.api_key = args.key

    listen_for_messages(args)