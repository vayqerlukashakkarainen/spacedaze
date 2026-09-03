import {
	deriveLevelSelectionSeed,
	deriveRunFloorSeed,
	getRunLevelPool,
	selectNextRunLevel,
} from "./runLevelPool"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const pool = getRunLevelPool("zone1")
assert(!!pool, "Zone 1 level pool should exist")

const firstSelection = selectNextRunLevel(
	pool!,
	new Set(),
	deriveLevelSelectionSeed(12345, 1)
)
assert(firstSelection === "level1", "Zone 1 should initially select level1")

const reusedSelection = selectNextRunLevel(
	pool!,
	new Set(["level1"]),
	deriveLevelSelectionSeed(12345, 2)
)
assert(
	reusedSelection === "level1",
	"A fully visited one-level pool should reuse level1"
)

const firstSeed = deriveRunFloorSeed(12345, 1, "level1")
const repeatedFirstSeed = deriveRunFloorSeed(12345, 1, "level1")
const secondSeed = deriveRunFloorSeed(12345, 2, "level1")
assert(firstSeed === repeatedFirstSeed, "Floor seeds should be deterministic")
assert(firstSeed !== secondSeed, "Reused levels should receive a new floor seed")

console.log("Run level pool tests passed")
