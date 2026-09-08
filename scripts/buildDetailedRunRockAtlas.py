"""Apply PixelLab-generated rock detail to the runtime hex-edge atlas."""

from math import hypot
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "docs/art-prototypes/run-rock-tiles/v2"
ORIGINAL_PATH = SOURCE_ROOT / "original-atlas.png"
OUTPUT_PATH = ROOT / "public/sprites/terrain/run-rock-high-atlas.png"
PREVIEW_PATH = SOURCE_ROOT / "preview.png"
FRAME_SIZE = 64
ATLAS_COLUMNS = 8
PALETTE = (0, 18, 38, 68, 108, 158, 210, 248)
EDGE_SEGMENTS = (
	((60, 48), (32, 63)),
	((32, 63), (4, 48)),
	((4, 48), (4, 16)),
	((4, 16), (32, 0)),
	((32, 0), (60, 16)),
	((60, 16), (60, 48)),
)
TILE_FRAME_BY_PIXEL_MASK = {
	0: 0, 1: 1, 2: 2, 4: 3, 8: 4, 16: 5, 32: 6,
	3: 7, 6: 8, 12: 9, 24: 10, 48: 11, 33: 12,
	7: 13, 14: 14, 28: 15, 56: 16, 49: 17, 35: 18,
	15: 19, 30: 20, 60: 21, 57: 22, 51: 23, 39: 24,
	31: 25, 62: 26, 61: 27, 59: 28, 55: 29, 47: 30,
}


def point_segment_distance(point, start, end):
	px, py = point
	ax, ay = start
	bx, by = end
	dx = bx - ax
	dy = by - ay
	length_squared = dx * dx + dy * dy
	if length_squared == 0:
		return hypot(px - ax, py - ay)
	amount = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length_squared))
	return hypot(px - (ax + dx * amount), py - (ay + dy * amount))


def nearest_palette(value):
	return min(PALETTE, key=lambda candidate: abs(candidate - value))


def reverse_six_bits(mask):
	result = 0
	for direction in range(6):
		if mask & (1 << direction):
			result |= 1 << (5 - direction)
	return result


def inside_hex(point):
	x, y = point
	if y < 16:
		return abs(x - 32) <= 28 * y / 16
	if y > 48:
		return abs(x - 32) <= 28 * (63 - y) / 15
	return 4 <= x <= 60


def load_pixellab_atlas():
	left = Image.open(SOURCE_ROOT / "pixellab-left.png").convert("RGBA")
	right = Image.open(SOURCE_ROOT / "pixellab-right.png").convert("RGBA")
	atlas = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
	atlas.alpha_composite(left, (0, 0))
	atlas.alpha_composite(right, (256, 0))
	return atlas


def build_atlas():
	original = Image.open(ORIGINAL_PATH).convert("RGBA")
	pixellab = load_pixellab_atlas()
	result = Image.new("RGBA", original.size, (0, 0, 0, 0))

	for y in range(original.height):
		for x in range(original.width):
			old_red, old_green, old_blue, old_alpha = original.getpixel((x, y))
			local = (x % FRAME_SIZE, y % FRAME_SIZE)
			if old_alpha == 0 or not inside_hex(local):
				continue
			new_red, new_green, new_blue, new_alpha = pixellab.getpixel((x, y))
			old_value = max(old_red, old_green, old_blue)
			new_value = max(new_red, new_green, new_blue) if new_alpha > 0 else 0
			near_boundary = min(
				point_segment_distance(local, start, end)
				for start, end in EDGE_SEGMENTS
			) <= 9

			if old_value >= 72:
				# PixelLab shades only edges already exposed by the source mask.
				value = 90 + new_value * 0.38 + old_value * 0.16
			elif near_boundary:
				# Suppress the full rings introduced by the generative edit.
				value = max(18, old_value * 0.7, new_value * 0.12)
			else:
				# Pull cracks, plates, and pits into the dark rock surface.
				value = max(18, old_value * 0.7, 8 + new_value * 0.32)

			gray = nearest_palette(min(248, value))
			result.putpixel((x, y), (gray, gray, gray, old_alpha))

	result.save(OUTPUT_PATH)
	return result


def frame_for_mask(atlas, mask):
	pixel_mask = reverse_six_bits(mask)
	frame_index = TILE_FRAME_BY_PIXEL_MASK.get(pixel_mask, 0)
	x = frame_index % ATLAS_COLUMNS * FRAME_SIZE
	y = frame_index // ATLAS_COLUMNS * FRAME_SIZE
	return atlas.crop((x, y, x + FRAME_SIZE, y + FRAME_SIZE))


def build_preview(atlas):
	preview = Image.new("RGBA", (720, 430), (3, 11, 16, 255))
	draw = ImageDraw.Draw(preview)
	directions = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))
	cells = {
		(q, r)
		for q in range(-3, 4)
		for r in range(-3, 4)
		if max(abs(q), abs(r), abs(-q - r)) <= 3
	}
	cells.remove((3, -1))
	cells.remove((-2, 3))
	placements = []
	for q, r in sorted(cells):
		mask = sum(
			1 << direction
			for direction, (dq, dr) in enumerate(directions)
			if (q + dq, r + dr) not in cells
		)
		center_x = 360 + 56 * q + 28 * r
		center_y = 150 + 22 * r
		placements.append((center_y, center_x, frame_for_mask(atlas, mask)))
	for center_y, center_x, frame in sorted(placements):
		preview.alpha_composite(frame, (round(center_x - 32), round(center_y - 32)))
	draw.text((20, 20), "PIXELLAB GRAYSCALE ASTEROID TERRAIN / 6-EDGE MASKED", fill=(108, 158, 210, 255))
	preview.resize((1440, 860), Image.Resampling.NEAREST).save(PREVIEW_PATH)


if __name__ == "__main__":
	atlas = build_atlas()
	build_preview(atlas)
