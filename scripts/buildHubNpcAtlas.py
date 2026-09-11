"""Build the 32px hub NPC atlas from its individual grayscale sprites."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "sprites" / "hub" / "npcs"
ATLAS_PATH = SOURCE_ROOT / "hub-npc-atlas.png"
FRAME_SIZE = 32
SPRITES = (
	"armorer",
	"quartermaster",
	"race-marshal",
	"navigator",
	"salvage-appraiser",
	"archivist",
	"signal-tender",
	"dockmaster",
)


def build_atlas() -> None:
	atlas = Image.new("RGBA", (FRAME_SIZE * len(SPRITES), FRAME_SIZE))
	for index, name in enumerate(SPRITES):
		path = SOURCE_ROOT / f"{name}.png"
		image = Image.open(path).convert("RGBA")
		if image.size != (FRAME_SIZE, FRAME_SIZE):
			raise ValueError(f"{path} must be {FRAME_SIZE}x{FRAME_SIZE}, got {image.size}")
		atlas.alpha_composite(image, (index * FRAME_SIZE, 0))
	atlas.save(ATLAS_PATH)
	print(f"Built {ATLAS_PATH.relative_to(ROOT)} with {len(SPRITES)} sprites")


if __name__ == "__main__":
	build_atlas()
