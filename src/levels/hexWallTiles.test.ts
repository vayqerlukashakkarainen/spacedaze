import assert from "node:assert/strict"
import {
	getConnectedHexWallEdgeProfile,
	getHexWallTopology,
	HexWallEnvironmentKind,
	rotateHexMask,
} from "./hexWallTiles"

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

const environmentKinds: HexWallEnvironmentKind[] = [
	"rock",
	"ruin",
	"machinery",
]
for (const kind of environmentKinds) {
	for (const hash of [0, 1, 17, 999]) {
		const profile = getConnectedHexWallEdgeProfile(kind, hash)
		assert.deepEqual(
			profile[0],
			{ along: 0, inset: 0 },
			`${kind} edge must start at the shared cell corner`
		)
		assert.deepEqual(
			profile.at(-1),
			{ along: 1, inset: 0 },
			`${kind} edge must end at the next shared cell corner`
		)
		for (let index = 1; index < profile.length; index++) {
			assert.ok(
				profile[index].along >= profile[index - 1].along,
				`${kind} edge profile must not fold back on itself`
			)
		}
	}
}

console.log("Hex wall autotile tests passed")
