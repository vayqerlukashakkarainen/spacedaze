"""Build the four-variation pointy-hex rock ground atlas."""

from math import hypot
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "docs/art-prototypes/run-rock-ground/tiles"
EDGE_ROOT = ROOT / "docs/art-prototypes/run-rock-tiles/edge-masks"
ATLAS_PATH = ROOT / "public/sprites/terrain/run-rock-ground-atlas.png"
PREVIEW_PATH = ROOT / "docs/art-prototypes/run-rock-ground/preview.png"
FRAME_SIZE = 64
ATLAS_COLUMNS = 16
VARIANT_COUNT = 4
PIXELLAB_SINGLE_EDGE_TILES = (1, 2, 3, 4, 5, 6)
PIXELLAB_EDGE_SEGMENTS = (
	((60, 48), (32, 63)),
	((32, 63), (4, 48)),
	((4, 48), (4, 16)),
	((4, 16), (32, 0)),
	((32, 0), (60, 16)),
	((60, 16), (60, 48)),
)
TRANSFORMS = (
	(None, (0, 1, 2, 3, 4, 5)),
	(Image.Transpose.FLIP_LEFT_RIGHT, (1, 0, 5, 4, 3, 2)),
	(Image.Transpose.FLIP_TOP_BOTTOM, (4, 3, 2, 1, 0, 5)),
	(Image.Transpose.ROTATE_180, (3, 4, 5, 0, 1, 2)),
)


def load_frames() -> tuple[list[Image.Image], list[Image.Image]]:
	surface_frames = [
		normalize_source_frame(
			Image.open(SOURCE_ROOT / f"tile_{index}.png").convert("RGBA")
		)
		for index in range(32)
	]
	edge_frames = [
		normalize_source_frame(
			Image.open(EDGE_ROOT / f"tile_{index}.png").convert("RGBA")
		)
		for index in range(32)
	]
	return surface_frames, edge_frames


def normalize_source_frame(frame: Image.Image) -> Image.Image:
	"""Keep the opaque floor distinct from the near-black game background."""
	result = frame.copy()
	for y in range(FRAME_SIZE):
		for x in range(FRAME_SIZE):
			red, green, blue, alpha = frame.getpixel((x, y))
			if alpha == 0:
				continue
			luminance = round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
			if luminance <= 8:
				gray = 0
			elif luminance <= 28:
				gray = 60
			elif luminance <= 110:
				gray = 100
			elif luminance <= 210:
				gray = 180
			else:
				gray = 255
			result.putpixel((x, y), (gray, gray, gray, 255))
	return result


def reverse_six_bits(mask: int) -> int:
	result = 0
	for direction in range(6):
		if mask & (1 << direction):
			result |= 1 << (5 - direction)
	return result


def transform_mask(mask: int, edge_map: tuple[int, ...]) -> int:
	result = 0
	for source_edge, destination_edge in enumerate(edge_map):
		if mask & (1 << source_edge):
			result |= 1 << destination_edge
	return result


def point_segment_distance(
	point: tuple[int, int],
	start: tuple[int, int],
	end: tuple[int, int],
) -> float:
	px, py = point
	ax, ay = start
	bx, by = end
	dx = bx - ax
	dy = by - ay
	length_squared = dx * dx + dy * dy
	if length_squared == 0:
		return hypot(px - ax, py - ay)
	amount = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_squared))
	nearest_x = ax + dx * amount
	nearest_y = ay + dy * amount
	return hypot(px - nearest_x, py - nearest_y)


def create_frame(
	pixel_lab_mask: int,
	surface_frame: Image.Image,
	edge_frames: list[Image.Image],
) -> Image.Image:
	# All variants share the same generated center tile, which keeps connected
	# sides pixel-identical. Only exposed edges receive the coastline art.
	result = surface_frame.copy()
	for edge, segment in enumerate(PIXELLAB_EDGE_SEGMENTS):
		if not pixel_lab_mask & (1 << edge):
			continue
		edge_frame = edge_frames[PIXELLAB_SINGLE_EDGE_TILES[edge]]
		for y in range(FRAME_SIZE):
			for x in range(FRAME_SIZE):
				if point_segment_distance((x, y), *segment) <= 12:
					result.putpixel((x, y), edge_frame.getpixel((x, y)))
	return result


def build_atlas(
	surface_frames: list[Image.Image],
	edge_frames: list[Image.Image],
) -> Image.Image:
	frame_count = 64 * VARIANT_COUNT
	atlas = Image.new(
		"RGBA",
		(ATLAS_COLUMNS * FRAME_SIZE, frame_count // ATLAS_COLUMNS * FRAME_SIZE),
		(0, 0, 0, 0),
	)
	for variant, (transpose, edge_map) in enumerate(TRANSFORMS):
		for game_mask in range(64):
			desired_mask = reverse_six_bits(game_mask)
			source_mask = transform_mask(desired_mask, edge_map)
			frame = create_frame(source_mask, surface_frames[0], edge_frames)
			if transpose is not None:
				frame = frame.transpose(transpose)
			frame_index = variant * 64 + game_mask
			x = frame_index % ATLAS_COLUMNS * FRAME_SIZE
			y = frame_index // ATLAS_COLUMNS * FRAME_SIZE
			atlas.alpha_composite(frame, (x, y))
	ATLAS_PATH.parent.mkdir(parents=True, exist_ok=True)
	atlas.save(ATLAS_PATH)
	return atlas


def build_preview(atlas: Image.Image) -> None:
	preview = Image.new("RGBA", (720, 520), (3, 11, 16, 255))
	draw = ImageDraw.Draw(preview)
	directions = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))
	cells = {
		(q, r)
		for q in range(-3, 4)
		for r in range(-3, 4)
		if max(abs(q), abs(r), abs(-q - r)) <= 3
	}
	for missing in ((3, -1), (-2, 3), (1, -3), (-3, 1)):
		cells.remove(missing)
	placements = []
	for index, (q, r) in enumerate(sorted(cells)):
		mask = sum(
			1 << direction
			for direction, (dq, dr) in enumerate(directions)
			if (q + dq, r + dr) not in cells
		)
		variant = (q * 17 + r * 29 + index) & 3
		frame_index = variant * 64 + mask
		x = frame_index % ATLAS_COLUMNS * FRAME_SIZE
		y = frame_index // ATLAS_COLUMNS * FRAME_SIZE
		frame = atlas.crop((x, y, x + FRAME_SIZE, y + FRAME_SIZE))
		center_x = 360 + 56 * q + 28 * r
		center_y = 245 + 48 * r
		placements.append((center_y, center_x, frame))
	for center_y, center_x, frame in sorted(placements):
		preview.alpha_composite(frame, (round(center_x - 32), round(center_y - 32)))
	draw.text((20, 20), "CONNECTED WAKE ROCK PLATFORM / 4 TILE VARIATIONS", fill=(98, 184, 203, 255))
	preview.resize((1440, 1040), Image.Resampling.NEAREST).save(PREVIEW_PATH)


if __name__ == "__main__":
	surfaces, edges = load_frames()
	atlas_image = build_atlas(surfaces, edges)
	build_preview(atlas_image)
