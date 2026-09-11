import {
	extendEndlessRoomFloor,
	generateRoomFloor,
} from "../rooms/roomFloorGenerator"
import { hexKey, hexNeighbors } from "../hexUtils"
import {
	DEFAULT_FLOOR_SUBLEVEL_COUNT,
	getFloorPositionForDepth,
	getFloorThemeIdForDepth,
	selectFloorMusicTrack,
	shouldSpawnBossRoomForDepth,
} from "../../levels/floorThemes/floorThemeDirectory"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

function serialize(seed: number, depth: number) {
	return JSON.stringify(generateRoomFloor(seed, depth))
}

assert(
	serialize(8128, 4) === serialize(8128, 4),
	"A floor seed must produce the same graph and encounters"
)
assert(
	serialize(8128, 4) !== serialize(8129, 4),
	"Different floor seeds should produce different floors"
)

const openingThemeIds = [
	"wake-scrap-district",
	"freebooter-exchange",
	"khelt-moltworks",
	"oruun-pilgrim-array",
	"naru-tide-ark",
	"silex-resonance-vault",
	"vey-living-convoy",
	"federation-claim-zone",
	"daze-scar",
] as const
for (let floor = 1; floor <= openingThemeIds.length; floor++) {
	for (let subfloor = 1; subfloor <= DEFAULT_FLOOR_SUBLEVEL_COUNT; subfloor++) {
		const depth = (floor - 1) * DEFAULT_FLOOR_SUBLEVEL_COUNT + subfloor
		assert(
			getFloorThemeIdForDepth(depth) === openingThemeIds[floor - 1],
			`Floor ${floor}.${subfloor} has the wrong opening theme`
		)
	}
}
assert(
	getFloorThemeIdForDepth(46) === "khelt-moltworks" &&
	getFloorThemeIdForDepth(50) === "khelt-moltworks" &&
	getFloorThemeIdForDepth(86) === "khelt-moltworks",
	"Deep themes should span five subfloors and follow the fixed eight-floor cycle"
)
const floorOneMusic = [
	"press_x_twice",
	"hysterical",
	"waynes_demise",
	"press_x_twice",
	"press_x_twice",
]
for (let depth = 1; depth <= DEFAULT_FLOOR_SUBLEVEL_COUNT; depth++) {
	const track = selectFloorMusicTrack(depth, 8128)
	assert(
		track?.music === floorOneMusic[depth - 1] && track.stems?.length === 4,
		`Floor 1.${depth} should use its complete assigned stem mix`
	)
}
assert(
	selectFloorMusicTrack(6, 8128) === undefined,
	"A floor without songs should not inherit the previous floor's music"
)
assert(
	shouldSpawnBossRoomForDepth(1) &&
	!shouldSpawnBossRoomForDepth(2) &&
	shouldSpawnBossRoomForDepth(DEFAULT_FLOOR_SUBLEVEL_COUNT),
	"Floor 1.1 should expose the boss test while preserving the normal floor finale"
)

const wakeBosses = new Set(
	Array.from({ length: 60 }, (_, seed) => {
		const floor = generateRoomFloor(seed + 1, 5, { milestoneBoss: true })
		return floor.rooms.find((room) => room.kind === "boss")?.bossId
	})
)
for (const bossId of [
	"federation-dreadnought",
	"wake-yardmaster",
	"wake-last-beacon",
] as const) {
	assert(wakeBosses.has(bossId), `Floor 1 boss pool is missing ${bossId}`)
}

for (let seed = 1; seed <= 200; seed++) {
	const depth = seed % 8 + 1
	const floor = generateRoomFloor(seed, depth, {
		milestoneBoss: shouldSpawnBossRoomForDepth(depth),
	})
	assert(
		floor.themeId === getFloorThemeIdForDepth(depth),
		`Seed ${seed} did not preserve its floor theme`
	)
	assert(floor.rooms.length >= 20 && floor.rooms.length <= 32, `Seed ${seed} has invalid room count`)
	const ids = new Set(floor.rooms.map((room) => room.id))
	assert(ids.size === floor.rooms.length, `Seed ${seed} has duplicate room ids`)
	const startRoom = floor.rooms.find((room) => room.id === floor.startRoomId)
	assert(startRoom?.connections.length === 1, `Seed ${seed} start room needs exactly one exit`)
	assert(floor.rooms.some((room) => room.kind === "reward"), `Seed ${seed} has no reward room`)
	const dangerousRooms = floor.rooms.filter((room) => room.dangerLevel === 3)
	assert(dangerousRooms.length >= 1, `Seed ${seed} has no extreme-risk room`)
	assert(
		dangerousRooms.every((room) =>
			room.kind === "combat" &&
			room.dangerReward !== undefined &&
			room.encounter?.enemies.every((enemy) => enemy.elite) === true
		),
		`Seed ${seed} has an invalid extreme-risk encounter`
	)
	const depositCount = floor.rooms.filter((room) => room.kind === "deposit").length
	assert(depositCount >= 1 && depositCount <= 2, `Seed ${seed} needs one or two deposit rooms`)
	assert(floor.rooms.filter((room) => room.kind === "shop").length === 1, `Seed ${seed} needs one shop room`)
	assert(floor.rooms.filter((room) => room.kind === "droneShop").length === 1, `Seed ${seed} needs one drone shop room`)
	const lockedRooms = floor.rooms.filter((room) => room.keyRequired)
	assert(lockedRooms.length === 3, `Seed ${seed} needs three locked rooms`)
	assert(
		lockedRooms.every((room) =>
			room.kind === "reward" ||
			room.kind === "shop" ||
			room.kind === "droneShop"
		),
		`Seed ${seed} locks a non-treasure room`
	)
	assert(
		hasRouteAvoidingRooms(floor.startRoomId, floor.exitRoomId, floor.rooms, new Set(
			lockedRooms.map((room) => room.id)
		)),
		`Seed ${seed} requires a key to reach its exit`
	)
	const subfloor = getFloorPositionForDepth(depth).subfloor
	const expectedMiniBossCount = 1
	assert(
		floor.rooms.filter((room) => room.kind === "miniBoss").length ===
			expectedMiniBossCount,
		`Seed ${seed} has the wrong mini-boss count for sublevel ${subfloor}`
	)
	assert(!floor.rooms.some((room) => String(room.kind) === "repair"), `Seed ${seed} contains a removed repair room`)
	assert(floor.rooms.filter((room) => room.kind === "gravity").length === 2, `Seed ${seed} needs two gravity rooms`)
	const exit = floor.rooms.find((room) => room.id === floor.exitRoomId)
	assert(exit !== undefined, `Seed ${seed} has no exit room`)
	assert(exit!.kind === (shouldSpawnBossRoomForDepth(depth) ? "boss" : "exit"), `Seed ${seed} has wrong exit kind`)
	const maxDistance = Math.max(...floor.rooms.map((room) => room.distanceFromStart))
	assert(exit!.distanceFromStart === maxDistance, `Seed ${seed} exit is not farthest from start`)
	const roomByCoord = new Map(floor.rooms.map((room) => [hexKey(room.coord), room]))
	const connectionCount = floor.rooms.reduce(
		(total, room) => total + room.connections.length,
		0
	) / 2
	assert(
		connectionCount >= floor.rooms.length,
		`Seed ${seed} should contain an alternate room connection`
	)
	assert(
		floor.rooms.filter((room) => room.connections.length >= 3).length >= 2,
		`Seed ${seed} should contain multiple junction rooms`
	)

	for (const room of floor.rooms) {
		assert(room.environment !== undefined, `${room.id} has no environment plan`)
		const environmentIds = new Set(
			room.environment!.objects.map((object) => object.id)
		)
		assert(
			environmentIds.size === room.environment!.objects.length,
			`${room.id} has duplicate environment object IDs`
		)
		for (const neighborCoord of hexNeighbors(room.coord)) {
			const adjacentRoom = roomByCoord.get(hexKey(neighborCoord))
			if (!adjacentRoom) continue
			assert(
				room.connections.includes(adjacentRoom.id),
				`${room.id} should connect to adjacent ${adjacentRoom.id}`
			)
		}
		for (const neighborId of room.connections) {
			const neighbor = floor.rooms.find((candidate) => candidate.id === neighborId)
			assert(neighbor !== undefined, `${room.id} links to missing room ${neighborId}`)
			assert(neighbor!.connections.includes(room.id), `${room.id} connection is not bidirectional`)
		}
		if (room.kind === "shrine") {
			assert(room.encounter === undefined, `${room.id} should activate its shrine directly`)
			continue
		}
		if (!["combat", "reward", "gravity", "event"].includes(room.kind)) continue
		assert(room.encounter !== undefined, `${room.id} has no encounter plan`)
		assert(room.encounter!.enemies.length > 0, `${room.id} has no planned enemies`)
		const enemyIds = new Set(room.encounter!.enemies.map((enemy) => enemy.id))
		assert(enemyIds.size === room.encounter!.enemies.length, `${room.id} has duplicate enemy ids`)
		assert(
			room.encounter!.enemies.every((enemy) =>
				enemy.arrivalMode === "resident" || enemy.arrivalMode === "phaseJump"
			),
			`${room.id} has an enemy without a valid arrival mode`
		)
		const openingWave = Math.min(...room.encounter!.enemies.map((enemy) => enemy.wave))
		assert(
			room.encounter!.enemies.some((enemy) =>
				enemy.wave === openingWave && enemy.arrivalMode === "resident"
			),
			`${room.id} should begin with at least one resident enemy`
		)
		assert(
			room.encounter!.enemies.every((enemy) =>
				enemy.enemyId !== "wake-scrappers-hut" || enemy.arrivalMode === "resident"
			),
			`${room.id} phase-jumps a Scrapper's Hut into combat`
		)
	}
}

const lassoEligibleFloors = Array.from({ length: 200 }, (_, index) =>
	generateRoomFloor(index + 1, 2, { lassoComponentAvailable: true })
)
assert(
	lassoEligibleFloors.some((floor) =>
		floor.rooms.some((room) => room.kind === "lassoComponent")
	),
	"Eligible floors should have a chance to generate a lasso component room"
)
assert(
	lassoEligibleFloors.every((floor) =>
		floor.rooms.filter((room) => room.kind === "lassoComponent").length <= 1
	),
	"A floor should never contain multiple lasso component rooms"
)
assert(
	lassoEligibleFloors.flatMap((floor) => floor.rooms)
		.filter((room) => room.kind === "lassoComponent")
		.every((room) => room.encounter !== undefined),
	"Lasso component rooms should require clearing an encounter"
)
assert(
	!generateRoomFloor(1, 2).rooms.some(
		(room) => room.kind === "lassoComponent"
	),
	"The lasso component room should not generate before it is eligible"
)

const lassoTrialFloors = Array.from({ length: 200 }, (_, index) =>
	generateRoomFloor(3000 + index, 2, { lassoTrialAvailable: true })
)
assert(
	lassoTrialFloors.every((floor) =>
		floor.rooms.filter((room) => room.kind === "lassoTrial").length === 1
	),
	"Every lasso-enabled floor should contain exactly one precision trial"
)
assert(
	lassoTrialFloors.flatMap((floor) => floor.rooms)
		.filter((room) => room.kind === "lassoTrial")
		.every((room) => room.encounter === undefined),
	"Lasso trials should remain dedicated puzzle rooms without encounters"
)
assert(
	!generateRoomFloor(3000, 2).rooms.some(
		(room) => room.kind === "lassoTrial"
	),
	"Lasso trials should not generate before the permanent lasso is unlocked"
)

const scrapCircuitEligibleFloors = Array.from({ length: 200 }, (_, index) =>
	generateRoomFloor(index + 1, 2, { scrapCircuitAvailable: true })
)
assert(
	scrapCircuitEligibleFloors.some((floor) =>
		floor.rooms.some((room) => room.kind === "scrapCircuit")
	),
	"Lasso-enabled floors should have a chance to generate a scrap circuit"
)
assert(
	scrapCircuitEligibleFloors.every((floor) =>
		floor.rooms.filter((room) => room.kind === "scrapCircuit").length <= 1
	),
	"A floor should never contain multiple scrap circuit rooms"
)
assert(
	scrapCircuitEligibleFloors.flatMap((floor) => floor.rooms)
		.filter((room) => room.kind === "scrapCircuit")
		.every((room) => room.encounter === undefined),
	"Scrap circuits should remain dedicated puzzle rooms without encounters"
)
assert(
	!generateRoomFloor(1, 2).rooms.some(
		(room) => room.kind === "scrapCircuit"
	),
	"Scrap circuits should not generate before the permanent lasso is unlocked"
)

const thrusterPuzzleFloors = Array.from({ length: 200 }, (_, index) =>
	generateRoomFloor(6000 + index, 2, { thrusterPuzzleAvailable: true })
)
assert(
	thrusterPuzzleFloors.every((floor) =>
		floor.rooms.filter((room) => room.kind === "thrusterPuzzle").length === 1
	),
	"Every eligible sublevel should contain exactly one thruster calibration puzzle"
)
assert(
	thrusterPuzzleFloors.flatMap((floor) => floor.rooms)
		.filter((room) => room.kind === "thrusterPuzzle")
		.every((room) => room.encounter === undefined),
	"Thruster calibration should remain a dedicated lasso puzzle without an encounter"
)
assert(
	!generateRoomFloor(6000, 2).rooms.some(
		(room) => room.kind === "thrusterPuzzle"
	),
	"Thruster calibration should not generate before the permanent lasso is unlocked"
)

const cargoEligibleFloors = Array.from({ length: 240 }, (_, index) =>
	generateRoomFloor(9000 + index, 2, { cargoPuzzleAvailable: true })
)
assert(
	cargoEligibleFloors.some((floor) => floor.cargoPuzzles.length === 1),
	"Lasso owners should have a chance to generate a cargo puzzle"
)
assert(
	cargoEligibleFloors.every((floor) => floor.cargoPuzzles.length <= 1),
	"A floor should never contain multiple cargo puzzles"
)
for (const floor of cargoEligibleFloors) {
	const puzzle = floor.cargoPuzzles[0]
	if (!puzzle) continue
	const source = floor.rooms.find((room) => room.id === puzzle.sourceRoomId)
	const target = floor.rooms.find((room) => room.id === puzzle.targetRoomId)
	assert(source?.kind === "cargoPuzzleSource", "Cargo puzzle needs a source room")
	assert(target?.kind === "cargoPuzzleTarget", "Cargo puzzle needs a target room")
	assert(
		source!.connections.includes(target!.id),
		"Cargo puzzle source and socket rooms must be directly connected"
	)
	assert(source!.encounter !== undefined, "Cargo should be secured by an encounter")
	assert(target!.encounter === undefined, "The cargo socket room should be safe")
}
assert(
	generateRoomFloor(9000, 2).cargoPuzzles.length === 0,
	"Cargo puzzles must not generate before the lasso is owned"
)

const expectedRoomCounts = [20, 24, 28, 32, 32]
for (let depth = 1; depth <= expectedRoomCounts.length; depth++) {
	assert(
		generateRoomFloor(4100 + depth, depth).rooms.length ===
			expectedRoomCounts[depth - 1],
		`Depth ${depth} should use the four-room progression step`
	)
}

const shallowFloor = generateRoomFloor(777, 1, { roomCount: 16 })
const deepFloor = generateRoomFloor(777, 8, { roomCount: 16 })
const wakeEnvironment = Array.from({ length: 8 }, (_, seedOffset) =>
	generateRoomFloor(777 + seedOffset, 1, { roomCount: 16 })
).flatMap((floor) => floor.rooms).flatMap(
	(room) => room.environment?.objects ?? []
)
assert(
	wakeEnvironment.some((object) => object.category === "destructible-cover") &&
	wakeEnvironment.some((object) => object.category === "dynamic-cover") &&
	wakeEnvironment.some((object) => object.category === "volatile"),
	"Wake floors should generate destructible, dynamic, and volatile objects"
)
const wakeSubfloorIdentityArchetypes = [
	["wake-fuel-cell"],
	["wake-pressure-tank"],
	["wake-battery-bank", "wake-sorting-gantry"],
	["wake-coolant-canister", "wake-patchwork-stall", "wake-signal-nest"],
	["wake-reactor-pod", "wake-breaker-crusher"],
] as const
for (let depth = 1; depth <= wakeSubfloorIdentityArchetypes.length; depth++) {
	const archetypes = new Set(Array.from({ length: 24 }, (_, seedOffset) =>
		generateRoomFloor(32000 + seedOffset, depth, { roomCount: 20 })
	).flatMap((floor) => floor.rooms).flatMap(
		(room) => room.environment?.objects.map((object) => object.archetypeId) ?? []
	))
	for (const archetypeId of wakeSubfloorIdentityArchetypes[depth - 1]) {
		assert(
			archetypes.has(archetypeId),
			`Floor 1.${depth} should generate its ${archetypeId} identity prop`
		)
	}
}
const wakeScrapFields = Array.from({ length: 120 }, (_, seedOffset) =>
	generateRoomFloor(12000 + seedOffset, 1, { roomCount: 20 })
).flatMap((floor) => floor.rooms.flatMap((room) =>
	(room.environment?.scrapFields ?? []).map((field) => ({ room, field }))
))
assert(wakeScrapFields.length > 0, "Wake room generation should place scrap fields")
assert(
	wakeScrapFields.every(({ room }) => room.kind === "combat"),
	"Scrap fields should only occupy ordinary combat rooms"
)
assert(
	wakeScrapFields.every(({ field }) =>
		field.scrap.length === 6 &&
		new Set(field.scrap.map((piece) => hexKey(piece.coord))).size === 6 &&
		!field.scrap.some((piece) => hexKey(piece.coord) === hexKey(field.center))
	),
	"Scrap fields should seal one reward cell with six unique scrap pieces"
)
const barrelClusterRooms = Array.from({ length: 120 }, (_, seedOffset) =>
	generateRoomFloor(16000 + seedOffset, 1, { roomCount: 20 })
).flatMap((floor) => floor.rooms).filter((room) =>
	(room.environment?.objects.filter((object) =>
		object.id.includes("barrel-cluster")
	).length ?? 0) >= 3
)
assert(barrelClusterRooms.length > 0, "Wake rooms should generate fuel-cell clusters")
assert(
	barrelClusterRooms.every((room) => room.kind === "combat"),
	"Fuel-cell clusters should only occupy ordinary combat rooms"
)
assert(
	deepFloor.rooms.every((room) => room.environment?.objects.length === 0),
	"Themes without an environment catalog should not inherit Wake objects"
)
const averageTier = (floor: ReturnType<typeof generateRoomFloor>) => {
	const encounters = floor.rooms.flatMap((room) => room.encounter ? [room.encounter] : [])
	return encounters.reduce((total, encounter) => total + encounter.tier, 0) / encounters.length
}
assert(
	averageTier(deepFloor) > averageTier(shallowFloor),
	"Deeper floors should pre-generate harder encounters"
)

const endlessFloor = generateRoomFloor(9917, 1, {
	endless: true,
	roomCount: 4,
	hubLevel: 1,
})
assert(endlessFloor.endless === true, "Endless floors should retain their mode")
assert(endlessFloor.rooms.length === 4, "Endless floors should start compact")
assert(
	endlessFloor.rooms.every((room) => room.kind === "chill" || room.kind === "combat"),
	"Endless floors should not generate exits or utility rooms"
)
for (let iteration = 0; iteration < 24; iteration++) {
	const frontier = endlessFloor.rooms
		.filter((room) => !room.connections.some((connectionId) => {
			const neighbor = endlessFloor.rooms.find((candidate) => candidate.id === connectionId)
			return neighbor && neighbor.distanceFromStart > room.distanceFromStart
		}))
		.sort((a, b) => b.distanceFromStart - a.distanceFromStart)[0]
	assert(frontier !== undefined, `Endless iteration ${iteration} has no frontier`)
	const added = extendEndlessRoomFloor(endlessFloor, frontier!.id)
	assert(added.length > 0, `Endless iteration ${iteration} did not grow the floor`)
}
const endlessIds = new Set(endlessFloor.rooms.map((room) => room.id))
assert(
	endlessIds.size === endlessFloor.rooms.length,
	"Endless expansion generated duplicate rooms"
)
for (const room of endlessFloor.rooms) {
	for (const connectionId of room.connections) {
		const neighbor = endlessFloor.rooms.find((candidate) => candidate.id === connectionId)
		assert(neighbor !== undefined, `${room.id} has a missing endless neighbor`)
		assert(
			neighbor!.connections.includes(room.id),
			`${room.id} has a one-way endless connection`
		)
	}
}

const cappedEndlessFloor = generateRoomFloor(1933, 1, {
	endless: true,
	roomCount: 100,
	maxRoomCount: 100,
	hubLevel: 1,
})
assert(
	cappedEndlessFloor.rooms.length === 100,
	"Capped endless floors should support a large pre-generated room count"
)
const concussionPlateRooms = cappedEndlessFloor.rooms.filter((room) =>
	room.environment?.objects.some(
		(object) => object.archetypeId === "wake-concussion-plate"
	)
)
assert(
	concussionPlateRooms.length > 0,
	"Long Wake floors should generate concussion plate rooms"
)
assert(
	concussionPlateRooms.every((room) => room.distanceFromStart >= 2),
	"Concussion plates should not appear in the opening rooms"
)
const slowdownPlateRooms = cappedEndlessFloor.rooms.filter((room) =>
	room.environment?.objects.some(
		(object) => object.archetypeId === "wake-slowdown-plate"
	)
)
assert(
	slowdownPlateRooms.length > 0,
	"Long Wake floors should generate slowdown plate rooms"
)
assert(
	slowdownPlateRooms.every((room) => room.distanceFromStart >= 2),
	"Slowdown plates should not appear in the opening rooms"
)
const teslaCoilRooms = cappedEndlessFloor.rooms.filter((room) =>
	room.environment?.objects.some(
		(object) => object.archetypeId === "wake-tesla-coil"
	)
)
assert(
	teslaCoilRooms.length > 0,
	"Long Wake floors should generate Tesla coil rooms"
)
assert(
	teslaCoilRooms.every((room) => room.kind === "combat"),
	"Tesla coils should only generate in ordinary combat rooms"
)
const cappedFrontier = cappedEndlessFloor.rooms.find((room) =>
	!room.connections.some((connectionId) => {
		const neighbor = cappedEndlessFloor.rooms.find(
			(candidate) => candidate.id === connectionId
		)
		return neighbor && neighbor.distanceFromStart > room.distanceFromStart
	})
)
assert(cappedFrontier !== undefined, "Capped endless floor should have a frontier")
assert(
	extendEndlessRoomFloor(cappedEndlessFloor, cappedFrontier!.id).length === 0,
	"Capped endless floors should stop expanding at their room limit"
)

function hasRouteAvoidingRooms(
	startId: string,
	targetId: string,
	rooms: Array<{ id: string; connections: string[] }>,
	blocked: Set<string>
) {
	const visited = new Set<string>([...blocked, startId])
	const queue = [startId]
	while (queue.length > 0) {
		const roomId = queue.shift()!
		if (roomId === targetId) return true
		const room = rooms.find((candidate) => candidate.id === roomId)!
		for (const neighborId of room.connections) {
			if (visited.has(neighborId)) continue
			visited.add(neighborId)
			queue.push(neighborId)
		}
	}
	return false
}

console.log("Room floor generator tests passed")
