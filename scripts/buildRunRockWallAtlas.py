"""Build the six-edge room wall atlas from PixelLab rock-ring sources."""

from math import atan2, cos, hypot, sin
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "docs/art-prototypes/run-rock-walls"
OUTPUT_PATH = ROOT / "public/sprites/terrain/run-rock-high-atlas.png"
PREVIEW_PATH = SOURCE_ROOT / "preview.png"
FRAME_SIZE = 64
ATLAS_COLUMNS = 8
VARIANT_COUNT = 2
PALETTE = (0, 18, 38, 68, 108, 158, 210, 248)
HEX_EDGES = (
	((60, 48), (32, 63)),
	((32, 63), (4, 48)),
	((4, 48), (4, 16)),
	((4, 16), (32, 0)),
	((32, 0), (60, 16)),
	((60, 16), (60, 48)),
)
FRAME_MASKS = (
	0, 1, 2, 4, 8, 16, 32,
	3, 6, 12, 24, 48, 33,
	7, 14, 28, 56, 49, 35,
	15, 30, 60, 57, 51, 39,
	31, 62, 61, 59, 55, 47,
)


def nearest_palette(value):
	return min(PALETTE, key=lambda candidate: abs(candidate - value))


def point_segment_distance(point, start, end):
	px, py = point
	ax, ay = start
	bx, by = end
	dx = bx - ax
	dy = by - ay
	length_squared = dx * dx + dy * dy
	amount = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length_squared))
	return hypot(px - (ax + dx * amount), py - (ay + dy * amount))


def ray_segment_radius(angle, start, end):
	direction = (cos(angle), sin(angle))
	ax, ay = start[0] - 32, start[1] - 32
	bx, by = end[0] - 32, end[1] - 32
	sx, sy = bx - ax, by - ay
	cross = direction[0] * sy - direction[1] * sx
	if abs(cross) < 0.00001:
		return None
	amount = (ax * sy - ay * sx) / cross
	edge_amount = (ax * direction[1] - ay * direction[0]) / cross
	if amount >= 0 and 0 <= edge_amount <= 1:
		return amount
	return None


def hex_radius(angle):
	radii = [
		radius
		for start, end in HEX_EDGES
		if (radius := ray_segment_radius(angle, start, end)) is not None
	]
	return min(radii)


def normalize_source(source):
	source = source.convert("RGBA")
	result = Image.new("RGBA", source.size, (0, 0, 0, 0))
	for y in range(source.height):
		for x in range(source.width):
			red, green, blue, alpha = source.getpixel((x, y))
			if alpha < 96:
				continue
			value = nearest_palette(max(red, green, blue))
			result.putpixel((x, y), (value, value, value, 255))
	return result


def warp_ring_to_hex(source):
	result = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
	center = (31.5, 31.5)
	for y in range(FRAME_SIZE):
		for x in range(FRAME_SIZE):
			dx = x - 32
			dy = y - 32
			angle = atan2(dy, dx)
			target_radius = hypot(dx, dy)
			boundary_radius = hex_radius(angle)
			# PixelLab's rings sit around radius 23. Preserve their rock depth while
			# bending the overall silhouette onto the exact game hex boundary.
			source_radius = 23 + (target_radius - boundary_radius) * 0.82
			sx = round(center[0] + cos(angle) * source_radius)
			sy = round(center[1] + sin(angle) * source_radius)
			if 0 <= sx < source.width and 0 <= sy < source.height:
				result.putpixel((x, y), source.getpixel((sx, sy)))
	return result


def frame_for_mask(full_ring, mask):
	result = Image.new("RGBA", full_ring.size, (0, 0, 0, 0))
	for y in range(FRAME_SIZE):
		for x in range(FRAME_SIZE):
			pixel = full_ring.getpixel((x, y))
			if pixel[3] == 0:
				continue
			edge = min(
				range(6),
				key=lambda index: point_segment_distance((x, y), *HEX_EDGES[index]),
			)
			if mask & (1 << edge):
				result.putpixel((x, y), pixel)
	return result


def build_atlas():
	sources = (
		SOURCE_ROOT / "ring-boulders.png",
		SOURCE_ROOT / "ring-slabs.png",
	)
	rings = [warp_ring_to_hex(normalize_source(Image.open(path))) for path in sources]
	frame_count = len(FRAME_MASKS) * VARIANT_COUNT
	rows = (frame_count + ATLAS_COLUMNS - 1) // ATLAS_COLUMNS
	atlas = Image.new(
		"RGBA",
		(ATLAS_COLUMNS * FRAME_SIZE, rows * FRAME_SIZE),
		(0, 0, 0, 0),
	)
	for mask_index, mask in enumerate(FRAME_MASKS):
		for variant, ring in enumerate(rings):
			frame_index = mask_index * VARIANT_COUNT + variant
			frame = frame_for_mask(ring, mask)
			atlas.alpha_composite(
				frame,
				(
					frame_index % ATLAS_COLUMNS * FRAME_SIZE,
					frame_index // ATLAS_COLUMNS * FRAME_SIZE,
				),
			)
	atlas.save(OUTPUT_PATH)
	return atlas


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
	for q, r in sorted(cells, key=lambda coord: (coord[1], coord[0])):
		mask = sum(
			1 << direction
			for direction, (dq, dr) in enumerate(directions)
			if (q + dq, r + dr) not in cells
		)
		try:
			mask_index = FRAME_MASKS.index(mask)
		except ValueError:
			continue
		variant = abs(q * 73 + r * 151) % VARIANT_COUNT
		frame_index = mask_index * VARIANT_COUNT + variant
		x = frame_index % ATLAS_COLUMNS * FRAME_SIZE
		y = frame_index // ATLAS_COLUMNS * FRAME_SIZE
		frame = atlas.crop((x, y, x + FRAME_SIZE, y + FRAME_SIZE))
		center_x = 360 + 56 * q + 28 * r
		center_y = 230 + 48 * r
		preview.alpha_composite(frame, (round(center_x - 32), round(center_y - 32)))
	draw.text((20, 20), "PIXELLAB BROKEN ASTEROID WALLS / 6-EDGE MASKED", fill=(108, 158, 210, 255))
	preview.resize((1440, 860), Image.Resampling.NEAREST).save(PREVIEW_PATH)


if __name__ == "__main__":
	atlas = build_atlas()
	build_preview(atlas)
