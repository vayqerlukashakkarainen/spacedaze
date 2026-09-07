"""Build the runtime hub settlement atlas and art review sheets."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

repo = Path(__file__).parent.parent
prototype = repo / "docs" / "art-prototypes" / "hub-buildings"
output = repo / "public" / "sprites" / "hub" / "settlement-atlas.png"
output.parent.mkdir(parents=True, exist_ok=True)

building_ids = [
	"service-kiosk",
	"courier-depot",
	"scrap-sorter",
	"smelter-annex",
	"listening-post",
	"repair-drydock",
	"fuel-farm",
	"freight-terminal",
	"habitat-cluster",
	"observatory-crown",
]
ruin_ids = building_ids[3:]
ground_ids = [
	"ground-small-a",
	"ground-small-b",
	"ground-medium-a",
	"ground-medium-b",
	"ground-large-a",
	"ground-large-b",
]
sources = (
	[(f"hub_building_{name.replace('-', '_')}", prototype / "sprites-v2" / f"{name}.png") for name in building_ids]
	+ [(f"hub_building_{name.replace('-', '_')}_destroyed", prototype / "ruins-v2" / f"{name}-destroyed.png") for name in ruin_ids]
	+ [(f"hub_{name.replace('-', '_')}", prototype / "foundations-v2" / "sprites" / f"{name}.png") for name in ground_ids]
)

cell_width = 256
cell_height = 192
columns = 4
rows = (len(sources) + columns - 1) // columns
atlas = Image.new("RGBA", (cell_width * columns, cell_height * rows))
entries = []

for index, (sprite, path) in enumerate(sources):
	image = Image.open(path).convert("RGBA")
	assert image.width <= cell_width and image.height <= cell_height, path
	pixels = list(image.get_flattened_data())
	assert {pixel[3] for pixel in pixels} <= {0, 255}, path
	assert {pixel[:3] for pixel in pixels if pixel[3]} <= {(0, 0, 0), (255, 255, 255)}, path
	x = index % columns * cell_width
	y = index // columns * cell_height
	atlas.alpha_composite(image, (x, y))
	entries.append({
		"sprite": sprite,
		"x": x,
		"y": y,
		"width": image.width,
		"height": image.height,
	})

pixels = atlas.load()
exterior = set()
queue = []
for x in range(atlas.width):
	queue.extend(((x, 0), (x, atlas.height - 1)))
for y in range(atlas.height):
	queue.extend(((0, y), (atlas.width - 1, y)))
while queue:
	x, y = queue.pop()
	if (x, y) in exterior or pixels[x, y][3] != 0:
		continue
	exterior.add((x, y))
	if x > 0:
		queue.append((x - 1, y))
	if x + 1 < atlas.width:
		queue.append((x + 1, y))
	if y > 0:
		queue.append((x, y - 1))
	if y + 1 < atlas.height:
		queue.append((x, y + 1))
for y in range(atlas.height):
	for x in range(atlas.width):
		red, green, blue, alpha = pixels[x, y]
		if (x, y) in exterior:
			pixels[x, y] = (0, 0, 0, 0)
		elif alpha == 0:
			pixels[x, y] = (0, 0, 0, 255)
		else:
			gray = round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
			pixels[x, y] = (gray, gray, gray, 255)

atlas.save(output)
(prototype / "settlement-atlas.json").write_text(json.dumps(entries, indent=2) + "\n")

font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 13)
small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 11)
title = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 23)
sheet = Image.new("RGB", (1440, 620), "#080d13")
draw = ImageDraw.Draw(sheet)
draw.text((24, 20), "SPACEDAZE / HUB RESTORATION STATES", font=title, fill="#eef4f4")
draw.text((24, 54), "RUIN AT LEVEL 1  /  REPLACED BY COMPLETED BUILDING AT ITS HUB LEVEL", font=small, fill="#6db8cb")

manifest = json.loads((prototype / "manifest.json").read_text())
for index, building in enumerate(manifest[3:]):
	ruin = Image.open(prototype / "ruins-v2" / f"{building['id']}-destroyed.png").convert("RGBA")
	built = Image.open(prototype / "sprites-v2" / f"{building['id']}.png").convert("RGBA")
	x = 16 + index % 4 * 356
	y = 88 + index // 4 * 255
	draw.rectangle((x, y, x + 340, y + 238), fill="#0c141d", outline="#223340")
	draw.text((x + 12, y + 12), building["name"].upper(), font=font, fill="#eef4f4")
	draw.text((x + 12, y + 36), f"RUIN  >  HUB LEVEL {index + 2}", font=small, fill="#6db8cb")
	max_width = 145
	max_height = 165
	for column, image in enumerate((ruin, built)):
		scale = min(1, max_width / image.width, max_height / image.height)
		if scale < 1:
			image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.NEAREST)
		paste_x = x + 12 + column * 164 + (max_width - image.width) // 2
		paste_y = y + 61 + (max_height - image.height) // 2
		sheet.paste(image, (paste_x, paste_y), image)

sheet.save(prototype / "ruins-contact-sheet.png")
print(f"Built {output} with {len(entries)} sprites")
