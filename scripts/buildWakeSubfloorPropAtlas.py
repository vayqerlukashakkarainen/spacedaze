"""Build the varied-size Wake subfloor prop atlas."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "sprites" / "rooms" / "environment"
ATLAS_PATH = SOURCE_ROOT / "wake-subfloor-props-atlas.png"
ATLAS_SIZE = (320, 128)
FRAMES = {
	"wake-sorting-gantry": (0, 0, 96, 48),
	"wake-breaker-crusher": (96, 0, 96, 64),
	"wake-pressure-tank": (192, 0, 64, 32),
	"wake-battery-bank": (256, 0, 48, 48),
	"wake-patchwork-stall": (0, 64, 80, 64),
	"wake-reactor-pod": (80, 64, 80, 64),
	"wake-signal-nest": (160, 64, 64, 64),
	"wake-coolant-canister": (224, 64, 32, 32),
}


def build_atlas() -> None:
	atlas = Image.new("RGBA", ATLAS_SIZE)
	for name, (x, y, width, height) in FRAMES.items():
		path = SOURCE_ROOT / f"{name}.png"
		image = Image.open(path).convert("RGBA")
		if image.size != (width, height):
			raise ValueError(
				f"{path} must be {width}x{height}, got {image.size[0]}x{image.size[1]}"
			)
		atlas.alpha_composite(image, (x, y))
	atlas.save(ATLAS_PATH)
	print(f"Built {ATLAS_PATH.relative_to(ROOT)} with {len(FRAMES)} props")


if __name__ == "__main__":
	build_atlas()
