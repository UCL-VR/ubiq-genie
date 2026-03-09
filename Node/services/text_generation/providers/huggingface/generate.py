"""HuggingFace Transformers local text generation with streaming output.

Reads user messages from stdin (one per line), streams response tokens to
stdout prefixed with '>'.  Falls back gracefully: CUDA -> MPS -> CPU.

NOTE: Large models require significant RAM in float16 (e.g., ~12-14 GB for
Qwen3-4B). Consider using the GGUF-quantised variant via llama.cpp or ollama.
"""

import sys
import argparse
import threading
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer

def get_device_and_dtype():
    """Pick the best available device and a compatible dtype."""
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    if torch.backends.mps.is_available():
        return "mps", torch.float16
    return "cpu", torch.float32


def load_model(model_name):
    """Load the tokenizer and model once at startup."""
    device, dtype = get_device_and_dtype()
    print(f"Loading model {model_name} on {device} ({dtype})...", file=sys.stderr)

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=dtype,
    ).to(device)

    print("Model loaded.", file=sys.stderr)
    return tokenizer, model


def generate_streaming(tokenizer, model, message_log):
    """Generate a response token-by-token and stream it to stdout."""
    text = tokenizer.apply_chat_template(
        message_log,
        tokenize=False,
        add_generation_prompt=True,
    )
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

    streamer = TextIteratorStreamer(
        tokenizer, skip_prompt=True, skip_special_tokens=True,
    )

    generation_kwargs = dict(
        **model_inputs,
        max_new_tokens=512,
        temperature=0.7,
        top_p=0.8,
        top_k=20,
        do_sample=True,
        streamer=streamer,
    )

    thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    full_response = []
    first_token = True
    for token_text in streamer:
        if token_text:
            full_response.append(token_text)
            if first_token:
                sys.stdout.write(">" + token_text)
                first_token = False
            else:
                sys.stdout.write(token_text)
            sys.stdout.flush()

    sys.stdout.write("\n")
    sys.stdout.flush()
    thread.join()
    return "".join(full_response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="Qwen/Qwen3-4B-Instruct-2507",
                        help="HuggingFace model ID or absolute path to a local model directory")
    parser.add_argument("--preprompt", type=str, default="")
    args = parser.parse_args()

    tokenizer, model = load_model(args.model)

    message_log = []
    if args.preprompt:
        message_log.append({"role": "system", "content": args.preprompt})

    sys.stdout.write(">READY\n")
    sys.stdout.flush()

    while True:
        try:
            line = sys.stdin.buffer.readline()
            if len(line) == 0:
                break
            if line.isspace():
                continue

            user_text = line.decode("utf-8").strip()
            print(f"[hf] IN:  {user_text!r}", file=sys.stderr)
            message_log.append({"role": "user", "content": user_text})

            sys.stdout.write(">BUSY\n")
            sys.stdout.flush()
            response = generate_streaming(tokenizer, model, message_log)
            sys.stdout.write(">IDLE\n")
            sys.stdout.flush()
            print(f"[hf] OUT: {response!r}", file=sys.stderr)
            message_log.append({"role": "assistant", "content": response})
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
