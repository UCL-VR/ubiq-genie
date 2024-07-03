import json
import sys
from openai import OpenAI
import os
import argparse

def request_response(message_log):
    global client
    response = client.chat.completions.create(model="gpt-3.5-turbo", messages=message_log, max_tokens=1000, temperature=0.7)

    # message_log.append(response.choices[0].message)
    message_log.append({"role": response.choices[0].message.role, "content": response.choices[0].message.content})
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
                {"role": "user", "content": line.decode("utf-8").strip() + args.prompt_suffix}
            )
            message_log = request_response(message_log)
            print(">" + message_log[-1]["content"])
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    global client
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    parser = argparse.ArgumentParser()
    parser.add_argument("--preprompt", type=str, default="")
    parser.add_argument("--prompt_suffix", type=str, default="")
    args = parser.parse_args()


    listen_for_messages(args)
