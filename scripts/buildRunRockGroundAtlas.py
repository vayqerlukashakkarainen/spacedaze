"""Build organic room-wide pointy-hex ground material families."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "docs/art-prototypes/run-rock-ground/tiles"
ATLAS_PATH = ROOT / "public/sprites/terrain/run-rock-ground-atlas.png"
PREVIEW_PATH = ROOT / "docs/art-prototypes/run-rock-ground/preview.png"
FRAME_SIZE = 64
VARIANT_COUNT = 4
SURFACE_SOURCE_NAMES = (
	"material-basalt.png",
	"material-salvage-rock.png",
	"material-rubble-dust.png",
)
MATERIAL_COUNT = len(SURFACE_SOURCE_NAMES)
VARIANTS_PER_MATERIAL = 4
VARIANT_COUNT = MATERIAL_COUNT * VARIANTS_PER_MATERIAL
GROUND_BASE_GRAY = 64
HEX_FILL_POINTS = (
	(32, -2),
	(60, 15),
	(60, 49),
	(32, 66),
	(4, 49),
	(4, 15),
)


def load_surfaces() -> list[Image.Image]:
	surfaces: list[Image.Image] = []
	for source_name in SURFACE_SOURCE_NAMES:
		source = Image.open(SOURCE_ROOT.parent / source_name).convert("RGBA")
		for variant in (
			source,
			source.transpose(Image.Transpose.FLIP_LEFT_RIGHT),
			source.transpose(Image.Transpose.FLIP_TOP_BOTTOM),
			source.transpose(Image.Transpose.ROTATE_180),
		):
			surfaces.append(normalize_source_frame(variant))
	return surfaces


def normalize_source_frame(frame: Image.Image) -> Image.Image:
	"""Crop a low-contrast organic texture to a regular pointy hex."""
	result = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
	mask = Image.new("L", (FRAME_SIZE, FRAME_SIZE), 0)
	ImageDraw.Draw(mask).polygon(HEX_FILL_POINTS, fill=255)
	luminance_counts: dict[int, int] = {}
	for red, green, blue, alpha in frame.get_flattened_data():
		if alpha == 0:
			continue
		luminance = round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
		luminance_counts[luminance] = luminance_counts.get(luminance, 0) + 1
	dominant_luminance = max(luminance_counts, key=luminance_counts.get)
	for y in range(FRAME_SIZE):
		for x in range(FRAME_SIZE):
			if mask.getpixel((x, y)) == 0:
				continue
			result.putpixel(
				(x, y),
				(GROUND_BASE_GRAY, GROUND_BASE_GRAY, GROUND_BASE_GRAY, 255),
			)
			red, green, blue, alpha = frame.getpixel((x, y))
			if alpha == 0:
				continue
			luminance = round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
			if luminance < dominant_luminance - 32:
				gray = 32
			elif luminance < dominant_luminance + 18:
				gray = GROUND_BASE_GRAY
			elif luminance < dominant_luminance + 58:
				gray = 88
			else:
				gray = 112
			result.putpixel((x, y), (gray, gray, gray, 255))
	return result


def build_atlas(surfaces: list[Image.Image]) -> Image.Image:
	atlas = Image.new(
		"RGBA",
		(VARIANT_COUNT * FRAME_SIZE, FRAME_SIZE),
		(0, 0, 0, 0),
	)
	for variant, surface in enumerate(surfaces):
		atlas.alpha_composite(surface, (variant * FRAME_SIZE, 0))
	ATLAS_PATH.parent.mkdir(parents=True, exist_ok=True)
	atlas.save(ATLAS_PATH)
	return atlas


def build_preview(atlas: Image.Image) -> None:
	preview = Image.new("RGBA", (1200, 480), (3, 11, 16, 255))
	draw = ImageDraw.Draw(preview)
	cells = {
		(q, r) for q in range(-3, 4) for r in range(-3, 4)
		if max(abs(q), abs(r), abs(-q - r)) <= 3
	}
	for material in range(MATERIAL_COUNT):
		placements = []
		for index, (q, r) in enumerate(sorted(cells)):
			variant = material * VARIANTS_PER_MATERIAL + (
				(q * 17 + r * 29 + index) % VARIANTS_PER_MATERIAL
			)
			frame = atlas.crop((
				variant * FRAME_SIZE,
				0,
				(variant + 1) * FRAME_SIZE,
				FRAME_SIZE,
			))
			center_x = 210 + material * 390 + 56 * q + 28 * r
			center_y = 230 + 48 * r
			placements.append((center_y, center_x, frame))
		for center_y, center_x, frame in sorted(placements):
			preview.alpha_composite(
				frame,
				(round(center_x - 32), round(center_y - 32)),
			)
	draw.text((20, 20), "ORGANIC ROOM MATERIAL FAMILIES / 4 VARIATIONS EACH", fill=(98, 184, 203, 255))
	preview.resize((2400, 960), Image.Resampling.NEAREST).save(PREVIEW_PATH)


if __name__ == "__main__":
	surfaces = load_surfaces()
	atlas_image = build_atlas(surfaces)
	build_preview(atlas_image)
