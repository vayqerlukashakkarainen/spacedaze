import assert from "node:assert/strict"
import { getRunRockTileFrame } from "./runRockTiles"

assert.equal(getRunRockTileFrame(0, 0), 0)
assert.equal(getRunRockTileFrame(0b000001, 0), 6)
assert.equal(getRunRockTileFrame(0b000010, 0), 5)
assert.equal(getRunRockTileFrame(0b000100, 0), 4)
assert.equal(getRunRockTileFrame(0b001000, 0), 3)
assert.equal(getRunRockTileFrame(0b010000, 0), 2)
assert.equal(getRunRockTileFrame(0b100000, 0), 1)
assert.equal(getRunRockTileFrame(0b110000, 0), 7)

assert.equal(getRunRockTileFrame(0b1000000, 0), 0)
assert.equal(getRunRockTileFrame(0b111111, 0), 25)
assert.equal(getRunRockTileFrame(0b111111, 1), 26)

for (let mask = 0; mask < 64; mask++) {
	const frame = getRunRockTileFrame(mask, 0)
	assert.ok(frame >= 0 && frame <= 30)
}

console.log("Run rock atlas frame tests passed")
