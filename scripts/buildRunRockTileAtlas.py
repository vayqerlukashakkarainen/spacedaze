"""Build the low-top-down run-map rock atlas from PixelLab source tiles."""

from math import hypot
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "docs/art-prototypes/run-rock-tiles"
BODY_ROOT = SOURCE_ROOT / "body-low"
EDGE_ROOT = SOURCE_ROOT / "edge-masks"
ATLAS_PATH = ROOT / "public/sprites/terrain/run-rock-low-atlas.png"
PREVIEW_PATH = SOURCE_ROOT / "preview.png"
FRAME_SIZE = 64
ATLAS_COLUMNS = 16
VARIANT_COUNT = 4
TOP_HEIGHT = 32
TOP_OFFSET_Y = 2
WHITE = (248, 248, 248, 255)

# PixelLab's edge masks run counter-clockwise from the lower-right edge.
PIXELLAB_MASK_TO_TILE = {
	0: 0,
	1: 1,
	2: 2,
	4: 3,
	8: 4,
	16: 5,
	32: 6,
	3: 7,
	6: 8,
	12: 9,
	24: 10,
	48: 11,
	33: 12,
	7: 13,
	14: 14,
	28: 15,
	56: 16,
	49: 17,
	35: 18,
	15: 19,
	30: 20,
	60: 21,
	57: 22,
	51: 23,
	39: 24,
	31: 25,
	62: 26,
	61: 27,
	59: 28,
	55: 29,
	47: 30,
}
PIXELLAB_SINGLE_EDGE_TILES = {
	0: 1,
	1: 2,
	2: 3,
	3: 4,
	4: 5,
	5: 6,
}
PIXELLAB_EDGE_SEGMENTS = (
	((60, 48), (32, 63)),
	((32, 63), (4, 48)),
	((4, 48), (4, 16)),
	((4, 16), (32, 0)),
	((32, 0), (60, 16)),
	((60, 16), (60, 48)),
)


def load_frames(root: Path, count: int) -> list[Image.Image]:
	return [
		Image.open(root / f"tile_{index}.png").convert("RGBA")
		for index in range(count)
	]


def reverse_six_bits(mask: int) -> int:
	result = 0
	for direction in range(6):
		if mask & (1 << direction):
			result |= 1 << (5 - direction)
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


def create_top_mask(pixel_lab_mask: int, edge_frames: list[Image.Image]) -> Image.Image:
	exact_tile = PIXELLAB_MASK_TO_TILE.get(pixel_lab_mask)
	if exact_tile is not None:
		return edge_frames[exact_tile].copy()

	# PixelLab's coastline set contains the 31 unambiguous contiguous masks.
	# Cellular maps can also produce split-edge masks, so build those from the
	# six generated single-edge treatments instead of drawing new art.
	result = edge_frames[0].copy()
	for direction, segment in enumerate(PIXELLAB_EDGE_SEGMENTS):
		if not pixel_lab_mask & (1 << direction):
			continue
		edge = edge_frames[PIXELLAB_SINGLE_EDGE_TILES[direction]]
		for y in range(FRAME_SIZE):
			for x in range(FRAME_SIZE):
				red, green, blue, alpha = edge.getpixel((x, y))
				if alpha == 0 or red < 200:
					continue
				if point_segment_distance((x, y), *segment) > 11:
					continue
				result.putpixel((x, y), WHITE)
	return result


def build_frame(
	game_mask: int,
	variant: int,
	body_frames: list[Image.Image],
	edge_frames: list[Image.Image],
) -> Image.Image:
	body_index = (game_mask * 5 + variant * 3) % len(body_frames)
	frame = body_frames[body_index].copy()
	pixel_lab_mask = reverse_six_bits(game_mask)
	top = create_top_mask(pixel_lab_mask, edge_frames)
	top = top.resize((FRAME_SIZE, TOP_HEIGHT), Image.Resampling.NEAREST)
	frame.alpha_composite(top, (0, TOP_OFFSET_Y))
	return frame


def build_atlas() -> Image.Image:
	body_frames = load_frames(BODY_ROOT, 16)
	edge_frames = load_frames(EDGE_ROOT, 32)
	frame_count = 64 * VARIANT_COUNT
	atlas_rows = frame_count // ATLAS_COLUMNS
	atlas = Image.new(
		"RGBA",
		(ATLAS_COLUMNS * FRAME_SIZE, atlas_rows * FRAME_SIZE),
		(0, 0, 0, 0),
	)
	for variant in range(VARIANT_COUNT):
		for game_mask in range(64):
			frame_index = variant * 64 + game_mask
			frame = build_frame(game_mask, variant, body_frames, edge_frames)
			x = frame_index % ATLAS_COLUMNS * FRAME_SIZE
			y = frame_index // ATLAS_COLUMNS * FRAME_SIZE
			atlas.alpha_composite(frame, (x, y))
	ATLAS_PATH.parent.mkdir(parents=True, exist_ok=True)
	atlas.save(ATLAS_PATH)
	return atlas


def build_preview(atlas: Image.Image) -> None:
	background = (3, 11, 16, 255)
	preview = Image.new("RGBA", (720, 430), background)
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
		center_y = 145 + 22 * r
		placements.append((center_y, center_x, frame))
	for center_y, center_x, frame in sorted(placements):
		preview.alpha_composite(frame, (round(center_x - 32), round(center_y - 20)))
	draw.text((20, 20), "LOW TOP-DOWN ROCK TERRAIN / 6-EDGE MASKED", fill=(98, 184, 203, 255))
	preview.resize((1440, 860), Image.Resampling.NEAREST).save(PREVIEW_PATH)


if __name__ == "__main__":
	atlas_image = build_atlas()
	build_preview(atlas_image)
