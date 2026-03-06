"""
FastVLM Visual Question Answering provider (official ml-fastvlm implementation).

Uses the official Apple ml-fastvlm repository for model loading and inference,
following the same approach as predict.py from the upstream repo.

Reads raw I420 video frames from stdin (prefixed with a JSON header line
containing width, height, and an optional prompt), runs them through
the FastVLM model, and writes the model's response as JSON to stdout.

Prerequisites:
  - Clone: git clone https://github.com/apple/ml-fastvlm
  - Install: pip install -e /path/to/ml-fastvlm
  - Download checkpoints: cd /path/to/ml-fastvlm && bash get_models.sh
  - Set fastvlmRepoPath in your app's config.json
"""

import argparse
import json
import os
import sys

import numpy as np
import torch
from PIL import Image

from llava.utils import disable_torch_init
from llava.conversation import conv_templates
from llava.model.builder import load_pretrained_model
from llava.mm_utils import tokenizer_image_token, process_images, get_model_name_from_path
from llava.constants import (
    IMAGE_TOKEN_INDEX,
    DEFAULT_IMAGE_TOKEN,
    DEFAULT_IM_START_TOKEN,
    DEFAULT_IM_END_TOKEN,
)

# Disable tqdm / HuggingFace progress bars
os.environ["TQDM_DISABLE"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"


def detect_device() -> str:
    """Return the best available device string."""
    if torch.cuda.is_available():
        return "cuda"
    try:
        if torch.backends.mps.is_available():
            return "mps"
    except AttributeError:
        pass
    return "cpu"


def load_model(model_path: str, device: str):
    """Load the FastVLM model using the official builder."""
    print(f"Loading model from {model_path} on {device} ...", file=sys.stderr)

    disable_torch_init()
    model_name = get_model_name_from_path(model_path)

    # Remove generation_config.json temporarily (matches official predict.py)
    gen_config_path = os.path.join(model_path, "generation_config.json")
    gen_config_backup = None
    if os.path.exists(gen_config_path):
        gen_config_backup = os.path.join(model_path, ".generation_config.json")
        os.rename(gen_config_path, gen_config_backup)

    try:
        tokenizer, model, image_processor, context_len = load_pretrained_model(
            model_path, None, model_name, device=device
        )
    finally:
        # Restore generation_config.json
        if gen_config_backup is not None:
            os.rename(gen_config_backup, gen_config_path)

    model.generation_config.pad_token_id = tokenizer.pad_token_id

    print(f"Model loaded (context_len={context_len}).", file=sys.stderr)
    return tokenizer, model, image_processor


def i420_to_rgb_image(data: bytes, width: int, height: int) -> Image.Image:
    """Convert a raw I420 (YUV420p) buffer to an RGB PIL Image."""
    y_size = width * height
    uv_width = width // 2
    uv_height = height // 2
    uv_size = uv_width * uv_height

    y = np.frombuffer(data, dtype=np.uint8, count=y_size).reshape((height, width)).astype(np.float32)
    u = np.frombuffer(data, dtype=np.uint8, offset=y_size, count=uv_size).reshape((uv_height, uv_width)).astype(np.float32)
    v = np.frombuffer(data, dtype=np.uint8, offset=y_size + uv_size, count=uv_size).reshape((uv_height, uv_width)).astype(np.float32)

    u = u.repeat(2, axis=0).repeat(2, axis=1)
    v = v.repeat(2, axis=0).repeat(2, axis=1)

    r = np.clip(y + 1.402 * (v - 128), 0, 255).astype(np.uint8)
    g = np.clip(y - 0.344136 * (u - 128) - 0.714136 * (v - 128), 0, 255).astype(np.uint8)
    b = np.clip(y + 1.772 * (u - 128), 0, 255).astype(np.uint8)

    rgb = np.stack([r, g, b], axis=-1)
    return Image.fromarray(rgb)


def process_frame(
    image: Image.Image,
    prompt: str,
    tokenizer,
    model,
    image_processor,
    device: str,
    conv_mode: str = "qwen_2",
    temperature: float = 0.2,
    max_new_tokens: int = 100,
) -> str:
    """Run inference on a single image following the official predict.py approach."""
    # Strip the <image> token from the prompt if it's there — we'll add it properly
    user_text = prompt.replace("<image>", "").strip()
    if user_text.startswith("\n"):
        user_text = user_text.lstrip("\n").strip()

    # Construct the prompt with image token
    if getattr(model.config, "mm_use_im_start_end", False):
        qs = DEFAULT_IM_START_TOKEN + DEFAULT_IMAGE_TOKEN + DEFAULT_IM_END_TOKEN + "\n" + user_text
    else:
        qs = DEFAULT_IMAGE_TOKEN + "\n" + user_text

    # Build conversation from template
    conv = conv_templates[conv_mode].copy()
    conv.append_message(conv.roles[0], qs)
    conv.append_message(conv.roles[1], None)
    full_prompt = conv.get_prompt()

    # Tokenize (handles the <image> token split correctly)
    input_ids = tokenizer_image_token(
        full_prompt, tokenizer, IMAGE_TOKEN_INDEX, return_tensors="pt"
    ).unsqueeze(0).to(device)

    # Process image using the official image processor
    image_tensor = process_images([image], image_processor, model.config)[0]

    with torch.inference_mode():
        output_ids = model.generate(
            input_ids,
            images=image_tensor.unsqueeze(0).half().to(device),
            image_sizes=[image.size],
            do_sample=temperature > 0,
            temperature=temperature,
            max_new_tokens=max_new_tokens,
            use_cache=True,
        )

    response = tokenizer.batch_decode(output_ids, skip_special_tokens=True)[0].strip()
    return response


def main():
    parser = argparse.ArgumentParser(description="FastVLM VQA (official ml-fastvlm)")
    parser.add_argument(
        "--model-path",
        type=str,
        required=True,
        help="Path to the FastVLM checkpoint directory (e.g. checkpoints/llava-fastvithd_0.5b_stage3)",
    )
    parser.add_argument("--conv-mode", type=str, default="qwen_2")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-new-tokens", type=int, default=100)
    args = parser.parse_args()

    device = detect_device()
    model_path = os.path.expanduser(args.model_path)
    tokenizer, model, image_processor = load_model(model_path, device)

    # Signal readiness to the parent process
    sys.stdout.write(">READY\n")
    sys.stdout.flush()

    default_prompt = "<image>\nDescribe this image in one concise sentence."

    # Protocol:
    # 1. JSON header line: {"width": int, "height": int, "prompt": "optional"}
    # 2. Raw I420 frame data: width * height * 3 // 2 bytes
    # Response: JSON line: {"description": "..."}
    while True:
        try:
            header_line = sys.stdin.buffer.readline()
            if not header_line:
                break

            header = json.loads(header_line.decode("utf-8").strip())
            width = header["width"]
            height = header["height"]
            prompt = header.get("prompt", default_prompt)

            frame_size = width * height * 3 // 2
            frame_data = b""
            while len(frame_data) < frame_size:
                chunk = sys.stdin.buffer.read(frame_size - len(frame_data))
                if not chunk:
                    break
                frame_data += chunk

            if len(frame_data) < frame_size:
                break

            image = i420_to_rgb_image(frame_data, width, height)
            response = process_frame(
                image,
                prompt,
                tokenizer,
                model,
                image_processor,
                device,
                conv_mode=args.conv_mode,
                temperature=args.temperature,
                max_new_tokens=args.max_new_tokens,
            )

            result = json.dumps({"description": response})
            sys.stdout.write(result + "\n")
            sys.stdout.flush()

        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}", file=sys.stderr)
            continue
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error processing frame: {e}", file=sys.stderr)
            continue


if __name__ == "__main__":
    main()
