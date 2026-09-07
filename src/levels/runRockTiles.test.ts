import assert from "node:assert/strict"
import {
	getRunRockTileFrame,
	RUN_ROCK_TILE_VARIANT_COUNT,
} from "./runRockTiles"

for (let mask = 0; mask < 64; mask++) {
	const frames = new Set<number>()
	for (let variant = 0; variant < RUN_ROCK_TILE_VARIANT_COUNT; variant++) {
		const frame = getRunRockTileFrame(mask, variant)
		assert.equal(frame & 0b111111, mask)
		frames.add(frame)
	}
	assert.equal(frames.size, RUN_ROCK_TILE_VARIANT_COUNT)
}

assert.equal(getRunRockTileFrame(0b1000000, 0), 0)
assert.equal(getRunRockTileFrame(0b1111111, 0), 0b111111)
assert.equal(getRunRockTileFrame(0, -1), 64)

console.log("Run rock atlas frame tests passed")
