"""Compose hub buildings over reusable floating ground slabs for review."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
buildings = json.loads((root / "manifest.json").read_text())
output = root / "composed"
output.mkdir(exist_ok=True)
ground_root = root / "foundations-v2" / "sprites"

foundations = {
	"service-kiosk": "ground-small-a",
	"courier-depot": "ground-small-b",
	"scrap-sorter": "ground-medium-a",
	"smelter-annex": "ground-medium-a",
	"listening-post": "ground-small-b",
	"repair-drydock": "ground-medium-b",
	"fuel-farm": "ground-medium-b",
	"freight-terminal": "ground-large-a",
	"habitat-cluster": "ground-large-b",
	"observatory-crown": "ground-large-b",
}
hub_levels = {
	"service-kiosk": 1,
	"courier-depot": 1,
	"scrap-sorter": 1,
	"smelter-annex": 2,
	"listening-post": 3,
	"repair-drydock": 4,
	"fuel-farm": 5,
	"freight-terminal": 6,
	"habitat-cluster": 7,
	"observatory-crown": 8,
}


def tint_ground(image: Image.Image) -> Image.Image:
	pixels = []
	for red, green, blue, alpha in image.convert("RGBA").get_flattened_data():
		if alpha == 0:
			pixels.append((0, 0, 0, 0))
		elif red + green + blue > 120:
			pixels.append((56, 73, 86, alpha))
		else:
			pixels.append((2, 7, 12, alpha))
	result = Image.new("RGBA", image.size)
	result.putdata(pixels)
	return result


def compose(structure: Image.Image, ground: Image.Image):
	ground_box = ground.getchannel("A").getbbox()
	structure_box = structure.getchannel("A").getbbox()
	assert ground_box and structure_box
	seat_y = ground_box[1] + round((ground_box[3] - ground_box[1]) * 0.48)
	structure_y = seat_y - structure_box[3]
	structure_x = (ground.width - structure.width) // 2
	left = min(0, structure_x)
	top = min(0, structure_y)
	right = max(ground.width, structure_x + structure.width)
	bottom = max(ground.height, structure_y + structure.height)
	padding = 4
	canvas = Image.new("RGBA", (right - left + padding * 2, bottom - top + padding * 2))
	ground_position = (padding - left, padding - top)
	building_position = (structure_x + padding - left, structure_y + padding - top)
	canvas.alpha_composite(ground, ground_position)
	canvas.alpha_composite(structure, building_position)
	return canvas, ground_position, building_position


for building in buildings:
	building["level"] = hub_levels[building["id"]]
	ground_id = foundations[building["id"]]
	ground_path = ground_root / f"{ground_id}.png"
	ground = tint_ground(Image.open(ground_path))
	structure = Image.open(root / "sprites-v2" / f"{building['id']}.png").convert("RGBA")
	composite, ground_position, building_position = compose(structure, ground)
	composite.save(output / f"{building['id']}.png")
	building["foundation"] = {
		"sprite": ground_id,
		"source": f"docs/art-prototypes/hub-buildings/foundations-v2/sprites/{ground_id}.png",
		"groundOffset": list(ground_position),
		"buildingOffset": list(building_position),
		"groundTint": [56, 73, 86],
	}

(root / "manifest.json").write_text(json.dumps(buildings, indent=2) + "\n")

font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 13)
small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 11)
title = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 23)

sheet = Image.new("RGB", (1440, 790), "#080d13")
draw = ImageDraw.Draw(sheet)
draw.text((24, 20), "SPACEDAZE / FLOATING HUB SETTLEMENT", font=title, fill="#eef4f4")
draw.text((24, 54), "SEPARATE BUILDING + REUSABLE FLAT GROUND PIECE", font=small, fill="#6db8cb")
for index, building in enumerate(buildings):
	image = Image.open(output / f"{building['id']}.png").convert("RGBA")
	max_width, max_height = 250, 275
	scale = min(1, max_width / image.width, max_height / image.height)
	if scale < 1:
		image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.NEAREST)
	x = 16 + index % 5 * 284
	y = 88 + index // 5 * 345
	draw.rectangle((x, y, x + 272, y + 330), fill="#0c141d", outline="#223340")
	draw.text((x + 12, y + 12), f"{index + 1:02d} / {building['name'].upper()}", font=font, fill="#eef4f4")
	draw.text((x + 12, y + 36), f"LEVEL {building['level']}  /  {building['foundation']['sprite'].upper()}", font=small, fill="#6db8cb")
	sheet.paste(image, (x + (272 - image.width) // 2, y + 49 + (275 - image.height) // 2), image)

sheet.save(root / "foundations-contact-sheet.png")

ground_sheet = Image.new("RGB", (960, 560), "#080d13")
ground_draw = ImageDraw.Draw(ground_sheet)
ground_draw.text((24, 20), "SPACEDAZE / FLOATING GROUND PIECES", font=title, fill="#eef4f4")
ground_draw.text((24, 54), "6 REUSABLE FLAT SLABS  /  SMALL TO LARGE  /  NATIVE PIXEL SIZE", font=small, fill="#6db8cb")
for index, ground_path in enumerate(sorted(ground_root.glob("*.png"))):
	image = tint_ground(Image.open(ground_path))
	x = 16 + index % 3 * 312
	y = 88 + index // 3 * 224
	ground_draw.rectangle((x, y, x + 296, y + 208), fill="#0c141d", outline="#223340")
	ground_draw.text((x + 12, y + 12), ground_path.stem.upper(), font=font, fill="#eef4f4")
	ground_draw.text((x + 12, y + 36), f"{image.width} x {image.height} PX", font=small, fill="#6db8cb")
	scale = min(1, 270 / image.width, 145 / image.height)
	if scale < 1:
		image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.NEAREST)
	ground_sheet.paste(image, (x + (296 - image.width) // 2, y + 55 + (145 - image.height) // 2), image)

ground_sheet.save(root / "ground-pieces-contact-sheet.png")
print("Composed 10 buildings with 6 reusable flat ground sprites")
