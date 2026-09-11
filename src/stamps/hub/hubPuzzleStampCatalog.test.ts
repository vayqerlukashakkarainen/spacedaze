import {
	getHubPuzzleStampDefinition,
	HUB_PUZZLE_STAMP_CATALOG,
	HUB_PUZZLE_STAMP_PLACEMENTS,
	type HubStampPoint,
} from "./hubPuzzleStampCatalog"
import {
	HUB_HALF_HEIGHT,
	HUB_HALF_WIDTH,
} from "../../services/hub/hubLayoutService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

assert(
	Object.keys(HUB_PUZZLE_STAMP_CATALOG).length === 2,
	"The initial hub stamp catalog should contain both converted puzzles"
)
assert(
	HUB_PUZZLE_STAMP_PLACEMENTS.length === 2,
	"Both hub puzzle stamps should have a placement"
)

const placedIds = new Set<string>()
for (const placement of HUB_PUZZLE_STAMP_PLACEMENTS) {
	assert(!placedIds.has(placement.stampId), `${placement.stampId} is placed twice`)
	placedIds.add(placement.stampId)
	const stamp = getHubPuzzleStampDefinition(placement.stampId)
	assert(stamp.minimumHubLevel >= 1, `${stamp.id} has an invalid hub level`)
	assert(
		Math.abs(placement.offset[0]) + stamp.bounds.width / 2 <= HUB_HALF_WIDTH,
		`${stamp.id} exceeds the horizontal hub bounds`
	)
	assert(
		Math.abs(placement.offset[1]) + stamp.bounds.height / 2 <= HUB_HALF_HEIGHT,
		`${stamp.id} exceeds the vertical hub bounds`
	)

	const points: HubStampPoint[] = stamp.type === "live-circuit"
		? [
			stamp.sourceCoilOffset,
			stamp.targetCoilOffset,
			stamp.headerOffset,
			stamp.rewardOffset,
			...stamp.conductors.map((conductor) => conductor.offset),
		]
		: [
			stamp.crate.offset,
			stamp.plate.offset,
			stamp.headerOffset,
			stamp.rewardOffset,
			...stamp.obstacles.map((obstacle) => obstacle.offset),
		]
	for (const point of points) {
		assert(
			Math.abs(point[0]) <= stamp.bounds.width / 2 &&
			Math.abs(point[1]) <= stamp.bounds.height / 2,
			`${stamp.id} contains an element outside its local bounds`
		)
	}

	const elementIds = stamp.type === "live-circuit"
		? stamp.conductors.map((conductor) => conductor.id)
		: stamp.obstacles.map((obstacle) => obstacle.id)
	assert(
		new Set(elementIds).size === elementIds.length,
		`${stamp.id} contains duplicate element IDs`
	)
}

console.log("Hub puzzle stamp catalog tests passed")
