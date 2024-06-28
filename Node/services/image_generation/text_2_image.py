import torch
from PIL import Image
import diffusers
import hashlib
import os
import sys
import json
import argparse
import transformers

def patch_conv(cls):
    init = cls.__init__

    def __init__(self, *args, **kwargs):
        return init(self, *args, **kwargs, padding_mode="circular")

    cls.__init__ = __init__

def generate_texture_from_prompt(pipe, generator, message):
    global busy
    print("Generating texture from prompt")
    message = message.decode()
    if message and not busy:
        busy = True
        message = json.loads(message)
        prompt = message["prompt"]
        file_name = message["output_file"] + ".png"

        prompt += args.prompt_postfix
        image = pipe(prompt, guidance_scale=7, num_inference_steps=5, generator=generator).images[0]
        fullpath = os.path.join(args.output_folder, file_name)
        image.save(fullpath)
        print(file_name)
        busy = False

def recognize_from_stdin():
    global pipe, generator, done, busy

    if pipe is None:
        print(f"Initializing texture generation model {args.model} (output folder: {args.output_folder}).")
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_built() else "cpu")

        pipe = diffusers.StableDiffusionPipeline.from_pretrained(
            args.model, variant="fp16", torch_dtype=torch.float16
        )
        pipe.to(device)
        pipe.enable_attention_slicing()
        generator = torch.Generator(device).manual_seed(1024)

    while not done:
        try:
            line = sys.stdin.buffer.readline()
            if line:
                generate_texture_from_prompt(pipe, generator, line)
        except KeyboardInterrupt:
            break

def main():
    global pipe, generator, done, busy, args

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="stabilityai/stable-diffusion-2")
    parser.add_argument("--output_folder", type=str, default="./output")
    parser.add_argument("--prompt_postfix", type=str, default="")
    parser.add_argument("--seamless", type=bool, default=True)
    args = parser.parse_args()

    if args.seamless:
        patch_conv(torch.nn.Conv2d)

    pipe = None
    generator = None
    busy = False
    done = False

    if not os.path.exists(args.output_folder):
        os.makedirs(args.output_folder)
        print("Output folder created at " + args.output_folder)

    recognize_from_stdin()

if __name__ == "__main__":
    main()