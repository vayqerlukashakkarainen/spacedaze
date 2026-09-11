export const RUN_ROCK_GROUND_TILE_SPRITE = "run_rock_ground"
export const RUN_ROCK_GROUND_TILE_SOURCE_RADIUS = 32
export const RUN_ROCK_GROUND_TILE_ANCHOR_Y = 32
export const RUN_ROCK_GROUND_MATERIALS = 3
export const RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL = 4
export const RUN_ROCK_GROUND_TILE_VARIANTS =
	RUN_ROCK_GROUND_MATERIALS * RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL

export function getRunRockGroundTileFrame(variation: number) {
	return Math.abs(variation) % RUN_ROCK_GROUND_TILE_VARIANTS
}
