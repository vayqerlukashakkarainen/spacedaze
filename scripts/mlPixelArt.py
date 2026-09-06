#!/usr/bin/env python3

import argparse
import subprocess
import tempfile
from pathlib import Path


BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
CONTROLNET_MODEL = "diffusers/controlnet-canny-sdxl-1.0-small"
PIXEL_ART_LORA = "glabs/pixel-art-xl"
FIXED_VAE = "madebyollin/sdxl-vae-fp16-fix"
ML_SIZE = 1024

STYLE_PROMPTS = {
	"ink": (
		"authentic hand-placed pure 1-bit pixel art game sprite, "
		"pure black and pure white only, broad connected shapes, thick readable "
		"silhouette, sparse deliberate highlights, clean large pixel clusters"
	),
	"dither": (
		"authentic hand-placed pure 1-bit pixel art game sprite, "
		"pure black and pure white only, broad connected shapes, thick readable "
		"silhouette, deliberate ordered checker dithering on large surfaces, "
		"engraved industrial texture"
	),
}

NEGATIVE_PROMPT = (
	"color, colored pixels, colored lighting, gray gradient, antialiasing, blur, "
	"smooth vector art, 3d render, photorealistic, scenery, drop shadow, text, "
	"watermark, random speckles, isolated noise, excessive micro-detail"
)


def parse_args():
	parser = argparse.ArgumentParser(
		description="Translate a source image into SpaceDaze pixel art with ControlNet and LoRA."
	)
	parser.add_argument("input", type=Path)
	parser.add_argument("output", type=Path)
	parser.add_argument("--style", choices=STYLE_PROMPTS, default="ink")
	parser.add_argument("--logical-size", type=int, default=128)
	parser.add_argument(
		"--file-size",
		type=int,
		help="PNG size; defaults to logical size for a native-resolution sprite.",
	)
	parser.add_argument("--subject", default="top-down science-fiction spacecraft")
	parser.add_argument("--seed", type=int, default=42)
	parser.add_argument("--steps", type=int, default=30)
	parser.add_argument("--strength", type=float, default=0.62)
	parser.add_argument("--control-scale", type=float, default=0.85)
	parser.add_argument("--lora-scale", type=float, default=1.0)
	parser.add_argument(
		"--ink-threshold",
		type=int,
		default=72,
		help="White/black split after ML translation; lower values make Ink sprites brighter.",
	)
	parser.add_argument(
		"--ml-preview",
		type=Path,
		help="Optional path for the large pre-conversion ML result.",
	)
	return parser.parse_args()


def require_dependencies():
	try:
		import cv2
		import diffusers
		import torch
		from PIL import Image
	except ImportError as error:
		raise SystemExit(
			"Missing ML art dependencies. Create the art environment with:\n"
			"  python3 -m venv .venv-art\n"
			"  .venv-art/bin/pip install -r requirements-art.txt\n"
			"Then run this script with .venv-art/bin/python.\n"
			f"Missing module: {error.name}"
		) from error
	return cv2, diffusers, torch, Image


def fit_source(image, Image):
	image = image.convert("RGBA")
	alpha_bounds = image.getchannel("A").getbbox()
	if alpha_bounds:
		image = image.crop(alpha_bounds)
	available = ML_SIZE - 128
	image.thumbnail((available, available), Image.Resampling.LANCZOS)
	canvas = Image.new("RGBA", (ML_SIZE, ML_SIZE), (255, 255, 255, 0))
	origin = ((ML_SIZE - image.width) // 2, (ML_SIZE - image.height) // 2)
	canvas.alpha_composite(image, origin)
	alpha = canvas.getchannel("A")
	flattened = Image.new("RGB", canvas.size, "white")
	flattened.paste(canvas.convert("RGB"), mask=alpha)
	return flattened, alpha


def create_canny(image, cv2, Image):
	import numpy as np

	gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
	edges = cv2.Canny(gray, 80, 180)
	edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
	return Image.fromarray(cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB))


def resolve_device(torch):
	if torch.cuda.is_available():
		return "cuda", torch.float16
	if torch.backends.mps.is_available():
		return "mps", torch.float16
	return "cpu", torch.float32


def generate_ml_image(args, cv2, diffusers, torch, Image):
	from diffusers import (
		AutoencoderKL,
		ControlNetModel,
		StableDiffusionXLControlNetImg2ImgPipeline,
		UniPCMultistepScheduler,
	)

	device, dtype = resolve_device(torch)
	print(f"Loading ML art pipeline on {device}")
	load_options = {"torch_dtype": dtype, "use_safetensors": True}
	base_load_options = dict(load_options)
	if dtype == torch.float16:
		base_load_options["variant"] = "fp16"
	controlnet = ControlNetModel.from_pretrained(CONTROLNET_MODEL, **load_options)
	vae = AutoencoderKL.from_pretrained(FIXED_VAE, **load_options)
	pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
		BASE_MODEL,
		controlnet=controlnet,
		vae=vae,
		**base_load_options,
	)
	pipe.load_lora_weights(PIXEL_ART_LORA, adapter_name="pixel_art")
	pipe.set_adapters(["pixel_art"], adapter_weights=[args.lora_scale])
	pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
	pipe.enable_attention_slicing()
	pipe.enable_vae_slicing()
	pipe.to(device)

	with Image.open(args.input) as source:
		initial_image, source_alpha = fit_source(source, Image)
	control_image = create_canny(initial_image, cv2, Image)
	generator = torch.Generator(device="cpu").manual_seed(args.seed)
	prompt = (
		f"{args.subject}, isolated centered sprite on a plain white background, "
		f"{STYLE_PROMPTS[args.style]}, gameplay view"
	)
	result = pipe(
		prompt=prompt,
		negative_prompt=NEGATIVE_PROMPT,
		image=initial_image,
		control_image=control_image,
		strength=args.strength,
		controlnet_conditioning_scale=args.control_scale,
		num_inference_steps=args.steps,
		guidance_scale=6.5,
		generator=generator,
	).images[0].convert("RGBA")
	result.putalpha(source_alpha)
	return result


def convert_to_game_sprite(args, ml_image_path):
	file_size = args.file_size or args.logical_size
	if args.logical_size <= 0 or file_size <= 0:
		raise SystemExit("logical size and file size must be positive")
	if file_size % args.logical_size != 0:
		raise SystemExit("file size must be an integer multiple of logical size")
	args.output.parent.mkdir(parents=True, exist_ok=True)
	subprocess.run(
		[
			"swift",
			"scripts/prepareGeneratedSprite.swift",
			str(ml_image_path),
			str(args.output),
			str(file_size),
			str(args.logical_size),
			args.style,
			str(args.ink_threshold),
		],
		check=True,
	)


def main():
	args = parse_args()
	if not args.input.is_file():
		raise SystemExit(f"Input image does not exist: {args.input}")
	cv2, diffusers, torch, Image = require_dependencies()
	ml_image = generate_ml_image(args, cv2, diffusers, torch, Image)

	if args.ml_preview:
		args.ml_preview.parent.mkdir(parents=True, exist_ok=True)
		ml_image.save(args.ml_preview)
		convert_to_game_sprite(args, args.ml_preview)
	else:
		with tempfile.TemporaryDirectory(prefix="spacedaze-art-") as directory:
			ml_image_path = Path(directory) / "ml-output.png"
			ml_image.save(ml_image_path)
			convert_to_game_sprite(args, ml_image_path)
	print(f"Saved {args.style} sprite to {args.output}")


if __name__ == "__main__":
	main()
