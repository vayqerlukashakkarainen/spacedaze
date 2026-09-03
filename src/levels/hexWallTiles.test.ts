import assert from "node:assert/strict"
import { getHexWallTopology, rotateHexMask } from "./hexWallTiles"

for (let mask = 0; mask < 64; mask++) {
	const topology = getHexWallTopology(mask)
	assert.equal(
		rotateHexMask(topology.canonicalMask, topology.rotation),
		mask,
		`canonical tile should reconstruct mask ${mask}`
	)

	for (let rotation = 0; rotation < 6; rotation++) {
		assert.equal(
			getHexWallTopology(rotateHexMask(mask, rotation)).canonicalMask,
			topology.canonicalMask,
			`rotations of mask ${mask} should share a tile type`
		)
	}
}

const canonicalTypes = new Set(
	Array.from({ length: 64 }, (_, mask) =>
		getHexWallTopology(mask).canonicalMask
	)
)
assert.equal(canonicalTypes.size, 14)

const adjacentPair = getHexWallTopology(0b000011).canonicalMask
const separatedPair = getHexWallTopology(0b000101).canonicalMask
const oppositePair = getHexWallTopology(0b001001).canonicalMask
assert.notEqual(adjacentPair, separatedPair)
assert.notEqual(adjacentPair, oppositePair)
assert.notEqual(separatedPair, oppositePair)

console.log("Hex wall autotile tests passed")
