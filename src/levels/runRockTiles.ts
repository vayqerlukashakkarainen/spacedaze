export const RUN_ROCK_TILE_SPRITE = "run_rock_low"
export const RUN_ROCK_TILE_SOURCE_RADIUS = 32
export const RUN_ROCK_TILE_ANCHOR_Y = 20
export const RUN_ROCK_TILE_VARIANT_COUNT = 4
export const RUN_ROCK_PROJECTION_Y_SCALE = 11 / 24

export function getRunRockTileFrame(exposedMask: number, hash: number) {
	const variant = Math.abs(hash) % RUN_ROCK_TILE_VARIANT_COUNT
	return variant * 64 + (exposedMask & 0b111111)
}
