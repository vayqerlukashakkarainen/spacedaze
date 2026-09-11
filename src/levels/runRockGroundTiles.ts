export const RUN_ROCK_GROUND_TILE_SPRITE = "run_rock_ground"
export const RUN_ROCK_GROUND_TILE_SOURCE_RADIUS = 32
export const RUN_ROCK_GROUND_TILE_ANCHOR_Y = 32
export const RUN_ROCK_GROUND_TILE_VARIANTS = 4

export function getRunRockGroundTileFrame(exposedMask: number, variation: number) {
	const normalizedVariation = Math.abs(variation) % RUN_ROCK_GROUND_TILE_VARIANTS
	return normalizedVariation * 64 + (exposedMask & 0b111111)
}
