import {
	createSimulatedEncounterEnemies,
	selectEncounterDefinition,
} from "../../services/enemies/enemyEncounterCatalogService"
import {
	isEnemyProgressionUnlocked,
	type ProgressionEnemyId,
} from "../../services/enemies/enemyProgressionService"
import { hexDistance, hexKey, hexNeighbors, type HexCoord } from "../hexUtils"
import { SeededRNG } from "../seededRng"
import {
	getFloorPositionForDepth,
	getFloorThemeIdForDepth,
} from "../../levels/floorThemes/floorThemeDirectory"
import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import { createWakeEncounterEnemies } from "../../services/enemies/wakeEncounterService"
import type {
	RoomEnemyArrivalMode,
	RoomEncounterPlan,
	RoomFloor,
	RoomFloorGenerationOptions,
	RoomFloorKind,
	RoomFloorRoom,
} from "./roomFloorTypes"
import { planRoomEnvironment } from "./roomEnvironmentPlanner"

const MIN_ROOMS = 20
const MAX_ROOMS = 32
const ROOM_COUNT_STEP = 4
const MAX_ROOM_DEGREE = 4
const ELITE_CHANCE_BY_TIER = [0, 0.04, 0.08, 0.15, 0.24, 0.34]

export function generateRoomFloor(
	seed: number,
	depth: number,
	options: RoomFloorGenerationOptions = {}
): RoomFloor {
	const normalizedDepth = Math.max(1, Math.floor(depth))
	const endlessRoomLimit = options.maxRoomCount === undefined
		? 8
		: Math.max(3, Math.floor(options.maxRoomCount))
	const targetCount = options.endless
		? clamp(options.roomCount ?? 4, 3, endlessRoomLimit)
		: clamp(
			options.roomCount ?? MIN_ROOMS +
				(normalizedDepth - 1) * ROOM_COUNT_STEP,
			MIN_ROOMS,
			MAX_ROOMS
		)
	const rng = new SeededRNG(mixSeed(seed, normalizedDepth, 701))
	const coords = growRoomGraph(targetCount, rng)
	const connections = connectAdjacentRooms(coords)
	const distances = calculateDistances(coords, connections)
	const exitIndex = selectFarthestRoom(coords, distances)
	const assignment = assignRoomKinds(
		coords,
		connections,
		distances,
		exitIndex,
		options.milestoneBoss === true,
		options.endless !== true,
		options.lassoComponentAvailable === true,
		options.lassoTrialAvailable === true,
		options.scrapCircuitAvailable === true,
		options.thrusterPuzzleAvailable === true,
		options.cargoPuzzleAvailable === true,
		rng
	)
	const kinds = assignment.kinds
	if (options.endless) {
		kinds.fill("combat")
		kinds[0] = "chill"
	}
	const maxDistance = Math.max(...distances)
	const themeId = getFloorThemeIdForDepth(normalizedDepth)
	const rooms = coords.map((coord, index): RoomFloorRoom => {
		const id = roomId(coord)
		const kind = kinds[index]
		const roomSeed = mixSeed(seed, coord.q, coord.r, normalizedDepth)
		return {
			id,
			coord: { ...coord },
			kind,
			templateId: selectTemplateId(kind, connections[index].length, roomSeed),
			seed: roomSeed,
			distanceFromStart: distances[index],
			connections: connections[index].map((neighborIndex) => roomId(coords[neighborIndex])),
			state: index === 0 ? "active" : connections[index].includes(0) ? "discovered" : "unseen",
			intelLevel: index === 0 ? 3 : connections[index].includes(0) ? 1 : 0,
			contentCompleted: false,
			keyRequired: kind === "reward" || kind === "shop" || kind === "droneShop",
			keyUnlocked: false,
			bossId: kind === "boss"
				? selectBossId(themeId, roomSeed)
				: undefined,
			encounter: roomUsesStandardEncounter(kind)
				? createEncounterPlan(
					roomSeed,
					normalizedDepth,
					distances[index],
					maxDistance,
					options.hubLevel ?? 1,
					themeId
				)
				: undefined,
		}
	})

	const dangerousRooms = rng.shuffle(rooms.filter((room) =>
		room.kind === "combat" && room.distanceFromStart >= 2
	)).slice(0, rooms.length >= 28 ? 2 : 1)
	for (let index = 0; index < dangerousRooms.length; index++) {
		const room = dangerousRooms[index]
		room.dangerLevel = 3
		room.dangerReward = index % 2 === 0 ? "doubleChest" : "salvageBurst"
		if (room.encounter) {
			room.encounter.difficultyBudget = Math.round(room.encounter.difficultyBudget * 1.8)
			room.encounter.rewardTier = 3
			for (const enemy of room.encounter.enemies) enemy.elite = true
			const reinforcementCandidates = room.encounter.enemies.filter((enemy) =>
				enemy.enemyId !== "wake-scrappers-hut"
			)
			const reinforcements = reinforcementCandidates.slice(
				0,
				Math.min(3, reinforcementCandidates.length)
			)
			for (let extra = 0; extra < reinforcements.length; extra++) {
				const source = reinforcements[extra]
				room.encounter.enemies.push({
					...source,
					id: `${source.id}-danger-${extra}`,
					wave: source.wave + 1,
					spawnSlot: extra,
					defeated: false,
					arrivalMode: "phaseJump",
				})
			}
		}
	}

	for (const room of rooms) {
		room.environment = planRoomEnvironment(
			room,
			themeId,
			getFloorPositionForDepth(normalizedDepth).subfloor
		)
	}

	return {
		seed,
		depth: normalizedDepth,
		themeId,
		endless: options.endless === true,
		maxRoomCount: options.maxRoomCount,
		hubLevel: options.hubLevel ?? 1,
		startRoomId: rooms[0].id,
		exitRoomId: rooms[exitIndex].id,
		currentRoomId: rooms[0].id,
		keys: 0,
		rooms,
		cargoPuzzles: assignment.cargoPuzzle
			? [{
				id: `cargo-${seed}-${normalizedDepth}`,
				sourceRoomId: rooms[assignment.cargoPuzzle.sourceIndex].id,
				targetRoomId: rooms[assignment.cargoPuzzle.targetIndex].id,
				socketActivated: false,
			}]
			: [],
	}
}

function selectBossId(themeId: FloorThemeId, seed: number) {
	if (themeId !== "wake-scrap-district") return "federation-dreadnought" as const
	const wakeBosses = [
		"federation-dreadnought",
		"wake-yardmaster",
		"wake-last-beacon",
	] as const
	return wakeBosses[Math.abs(seed) % wakeBosses.length]
}

export function extendEndlessRoomFloor(
	floor: RoomFloor,
	fromRoomId: string
) {
	if (!floor.endless) return []
	if (
		floor.maxRoomCount !== undefined &&
		floor.rooms.length >= floor.maxRoomCount
	) return []
	const source = floor.rooms.find((room) => room.id === fromRoomId)
	if (!source) return []
	const hasForwardConnection = source.connections.some((connectionId) => {
		const neighbor = floor.rooms.find((room) => room.id === connectionId)
		return neighbor && neighbor.distanceFromStart > source.distanceFromStart
	})
	if (hasForwardConnection) return []

	const occupied = new Set(floor.rooms.map((room) => hexKey(room.coord)))
	const rng = new SeededRNG(mixSeed(
		floor.seed,
		source.coord.q,
		source.coord.r,
		floor.rooms.length,
		1701
	))
	const candidates = rng.shuffle(
		hexNeighbors(source.coord).filter((coord) => !occupied.has(hexKey(coord)))
	)
	const branchCount = candidates.length > 1 && rng.nextBool(0.3) ? 2 : 1
	const addedRooms: RoomFloorRoom[] = []

	const remainingRoomCount = floor.maxRoomCount === undefined
		? branchCount
		: Math.max(0, floor.maxRoomCount - floor.rooms.length)
	for (const coord of candidates.slice(
		0,
		Math.min(branchCount, remainingRoomCount)
	)) {
		const id = roomId(coord)
		const adjacentRooms = floor.rooms.filter((room) =>
			hexDistance(room.coord, coord) === 1
		)
		const distanceFromStart = Math.min(
			...adjacentRooms.map((room) => room.distanceFromStart + 1)
		)
		const roomSeed = mixSeed(
			floor.seed,
			coord.q,
			coord.r,
			floor.depth
		)
		const room: RoomFloorRoom = {
			id,
			coord: { ...coord },
			kind: "combat",
			templateId: selectTemplateId("combat", adjacentRooms.length, roomSeed),
			seed: roomSeed,
			distanceFromStart,
			connections: adjacentRooms.map((neighbor) => neighbor.id),
			state: "discovered",
			contentCompleted: false,
			keyRequired: false,
			keyUnlocked: true,
			encounter: createEncounterPlan(
				roomSeed,
				floor.depth,
				distanceFromStart,
				Math.max(1, distanceFromStart + 2),
				floor.hubLevel ?? 1,
				floor.themeId
			),
		}
		for (const neighbor of adjacentRooms) {
			if (!neighbor.connections.includes(id)) neighbor.connections.push(id)
			neighbor.templateId = selectTemplateId(
				neighbor.kind,
				neighbor.connections.length,
				neighbor.seed
			)
		}
		room.environment = planRoomEnvironment(
			room,
			floor.themeId,
			getFloorPositionForDepth(floor.depth).subfloor
		)
		floor.rooms.push(room)
		floor.exitRoomId = room.id
		addedRooms.push(room)
	}

	source.environment = planRoomEnvironment(
		source,
		floor.themeId,
		getFloorPositionForDepth(floor.depth).subfloor
	)
	return addedRooms
}

function growRoomGraph(targetCount: number, rng: SeededRNG) {
	const coords: HexCoord[] = [{ q: 0, r: 0 }]
	const occupied = new Set([hexKey(coords[0])])
	const degrees = [0]

	while (coords.length < targetCount) {
		const origin = coords[0]
		const canExpandTo = (coord: HexCoord) =>
			!occupied.has(hexKey(coord)) &&
			(coords.length === 1 || hexDistance(coord, origin) > 1)
		const parentCandidates = coords
			.map((coord, index) => ({ coord, index }))
			.filter(({ coord, index }) =>
				(coords.length === 1 || index !== 0) &&
				degrees[index] < MAX_ROOM_DEGREE &&
				hexNeighbors(coord).some(canExpandTo)
			)
		if (parentCandidates.length === 0) break

		const weightedParents = parentCandidates.flatMap((candidate) =>
			Array.from(
				{ length: Math.max(1, MAX_ROOM_DEGREE - degrees[candidate.index]) },
				() => candidate
			)
		)
		const parent = rng.choice(weightedParents)
		const openNeighbors = rng.shuffle(
			hexNeighbors(parent.coord).filter(canExpandTo)
		)
		const selected = openNeighbors[0]
		if (!selected) continue
		occupied.add(hexKey(selected))
		coords.push(selected)
		degrees[parent.index]++
		degrees.push(1)
	}

	return coords
}

function connectAdjacentRooms(coords: HexCoord[]) {
	const indexByKey = new Map(coords.map((coord, index) => [hexKey(coord), index]))
	const connections = coords.map(() => new Set<number>())

	for (let index = 0; index < coords.length; index++) {
		for (const neighbor of hexNeighbors(coords[index])) {
			const neighborIndex = indexByKey.get(hexKey(neighbor))
			if (neighborIndex === undefined || neighborIndex <= index) continue
			connections[index].add(neighborIndex)
			connections[neighborIndex].add(index)
		}
	}

	return connections.map((neighbors) => [...neighbors].sort((a, b) => a - b))
}

function calculateDistances(coords: HexCoord[], connections: number[][]) {
	const distances = coords.map(() => Number.POSITIVE_INFINITY)
	distances[0] = 0
	const queue = [0]
	while (queue.length > 0) {
		const index = queue.shift()!
		for (const neighbor of connections[index]) {
			if (distances[neighbor] !== Number.POSITIVE_INFINITY) continue
			distances[neighbor] = distances[index] + 1
			queue.push(neighbor)
		}
	}
	return distances
}

function selectFarthestRoom(coords: HexCoord[], distances: number[]) {
	return coords
		.map((coord, index) => ({ coord, index, distance: distances[index] }))
		.sort((a, b) =>
			b.distance - a.distance ||
			hexDistance(b.coord, { q: 0, r: 0 }) - hexDistance(a.coord, { q: 0, r: 0 }) ||
			a.index - b.index
		)[0].index
}

function assignRoomKinds(
	coords: HexCoord[],
	connections: number[][],
	distances: number[],
	exitIndex: number,
	milestoneBoss: boolean,
	allowMiniBoss: boolean,
	allowLassoComponent: boolean,
	allowLassoTrial: boolean,
	allowScrapCircuit: boolean,
	allowThrusterPuzzle: boolean,
	allowCargoPuzzle: boolean,
	rng: SeededRNG
) {
	const kinds = coords.map((): RoomFloorKind => "combat")
	kinds[0] = "chill"
	kinds[exitIndex] = milestoneBoss ? "boss" : "exit"
	const candidates = coords
		.map((_, index) => index)
		.filter((index) => index !== 0 && index !== exitIndex)
	const deadEnds = candidates
		.filter((index) => connections[index].length === 1)
		.sort((a, b) => distances[b] - distances[a])
	const used = new Set([0, exitIndex])
	const optionalLockedRooms = candidates.filter((index) =>
		distances[index] >= 2 &&
		hasPathAvoidingRooms(connections, 0, exitIndex, [index])
	)
	const takeRoom = (
		preferDeadEnd: boolean,
		allowed: readonly number[] = candidates
	) => {
		const allowedSet = new Set(allowed)
		const preferred = (preferDeadEnd ? deadEnds : allowed)
			.filter((index) => allowedSet.has(index) && !used.has(index))
		const pool = preferred.length > 0
			? preferred
			: allowed.filter((index) => !used.has(index))
		if (pool.length === 0) return undefined
		const index = preferDeadEnd ? pool[0] : rng.choice(pool)
		used.add(index)
		return index
	}
	const reward = takeRoom(true, optionalLockedRooms)
	if (reward !== undefined) kinds[reward] = "reward"
	const shopCandidates = optionalLockedRooms.filter((index) =>
		reward === undefined ||
		hasPathAvoidingRooms(connections, 0, exitIndex, [reward, index])
	)
	const shop = takeRoom(true, shopCandidates)
	if (shop !== undefined) kinds[shop] = "shop"
	const droneShopCandidates = optionalLockedRooms.filter((index) =>
		(reward === undefined || index !== reward) &&
		(shop === undefined || index !== shop) &&
		hasPathAvoidingRooms(
			connections,
			0,
			exitIndex,
			[reward, shop, index].filter((room): room is number => room !== undefined)
		)
	)
	const droneShop = takeRoom(true, droneShopCandidates)
	if (droneShop !== undefined) kinds[droneShop] = "droneShop"
	if (allowThrusterPuzzle) {
		const thrusterPuzzle = takeRoom(true)
		if (thrusterPuzzle !== undefined) kinds[thrusterPuzzle] = "thrusterPuzzle"
	}
	if (allowLassoTrial) {
		const lassoTrial = takeRoom(true)
		if (lassoTrial !== undefined) kinds[lassoTrial] = "lassoTrial"
	}
	if (allowLassoComponent && rng.nextBool(0.35)) {
		const lassoComponent = takeRoom(true)
		if (lassoComponent !== undefined) kinds[lassoComponent] = "lassoComponent"
	}
	if (allowScrapCircuit && rng.nextBool(0.55)) {
		const scrapCircuit = takeRoom(true)
		if (scrapCircuit !== undefined) kinds[scrapCircuit] = "scrapCircuit"
	}
	let cargoPuzzle: { sourceIndex: number; targetIndex: number } | undefined
	if (allowCargoPuzzle && rng.nextBool(0.45)) {
		const sourceCandidates = rng.shuffle(candidates.filter((index) =>
			!used.has(index) && connections[index].some((neighbor) =>
				candidates.includes(neighbor) && !used.has(neighbor)
			)
		))
		const sourceIndex = sourceCandidates[0]
		if (sourceIndex !== undefined) {
			const targetCandidates = rng.shuffle(connections[sourceIndex].filter(
				(index) => candidates.includes(index) && !used.has(index)
			)).sort((a, b) => distances[b] - distances[a])
			const targetIndex = targetCandidates[0]
			if (targetIndex !== undefined) {
				used.add(sourceIndex)
				used.add(targetIndex)
				kinds[sourceIndex] = "cargoPuzzleSource"
				kinds[targetIndex] = "cargoPuzzleTarget"
				cargoPuzzle = { sourceIndex, targetIndex }
			}
		}
	}
	const support = takeRoom(false)
	if (support !== undefined) kinds[support] = rng.choice(["health", "shrine"])
	const gravityA = takeRoom(true)
	const gravityB = takeRoom(false)
	if (gravityA !== undefined && gravityB !== undefined) {
		kinds[gravityA] = "gravity"
		kinds[gravityB] = "gravity"
	}
	if (allowMiniBoss) {
		const miniBoss = takeRoom(true)
		if (miniBoss !== undefined) kinds[miniBoss] = "miniBoss"
	}
	if (coords.length >= 13) {
		const event = takeRoom(false)
		if (event !== undefined) kinds[event] = "event"
	}
	const depositCount = coords.length >= 12 && rng.nextBool(0.35) ? 2 : 1
	for (let index = 0; index < depositCount; index++) {
		const deposit = takeRoom(true)
		if (deposit !== undefined) kinds[deposit] = "deposit"
	}
	return { kinds, cargoPuzzle }
}

function hasPathAvoidingRooms(
	connections: readonly number[][],
	startIndex: number,
	exitIndex: number,
	blockedIndices: readonly number[]
) {
	const visited = new Set<number>([...blockedIndices, startIndex])
	const queue = [startIndex]
	while (queue.length > 0) {
		const current = queue.shift()!
		if (current === exitIndex) return true
		for (const neighbor of connections[current]) {
			if (visited.has(neighbor)) continue
			visited.add(neighbor)
			queue.push(neighbor)
		}
	}
	return false
}

function roomUsesStandardEncounter(kind: RoomFloorKind) {
	return kind === "combat" ||
		kind === "reward" ||
		kind === "gravity" ||
		kind === "event" ||
		kind === "lassoComponent" ||
		kind === "cargoPuzzleSource"
}

function createEncounterPlan(
	seed: number,
	depth: number,
	distance: number,
	maxDistance: number,
	hubLevel: number,
	themeId: FloorThemeId
): RoomEncounterPlan {
	const rng = new SeededRNG(seed)
	const distanceTier = maxDistance <= 0 ? 0 : Math.floor(distance / maxDistance * 2)
	const tier = clamp(1 + Math.floor((depth - 1) / 2) + distanceTier, 1, 5)
	const random = () => rng.nextFloat()
	const isAvailable = (id: ProgressionEnemyId) => isEnemyProgressionUnlocked(id, {
		runDepth: depth,
		hubLevel,
	})
	const definition = themeId === "wake-scrap-district"
		? undefined
		: selectEncounterDefinition(tier, random, true, isAvailable)
	const enemyIds = themeId === "wake-scrap-district"
		? createWakeEncounterEnemies(
			tier,
			random,
			getFloorPositionForDepth(depth).subfloor
		)
		: definition
			? createSimulatedEncounterEnemies(definition, tier, random, isAvailable)
			: ["fighter" as const]
	const difficultyBudget = 5 + tier * 2
	const maxWaveSize = tier >= 4 ? 5 : 4
	return {
		id: `encounter-${seed}`,
		tier,
		difficultyBudget,
		rewardTier: clamp(1 + Math.floor((tier - 1) / 2), 1, 3),
		enemies: enemyIds.map((enemyId, index) => {
			const wave = Math.floor(index / maxWaveSize)
			return {
				id: `enemy-${seed}-${index}`,
				enemyId,
				wave,
				spawnSlot: index % maxWaveSize,
				elite: tier >= 2 && rng.nextBool(ELITE_CHANCE_BY_TIER[tier]),
				defeated: false,
				arrivalMode: selectEnemyArrivalMode(enemyId, wave, index, rng),
			}
		}),
	}
}

function selectEnemyArrivalMode(
	enemyId: ProgressionEnemyId,
	wave: number,
	index: number,
	rng: SeededRNG
): RoomEnemyArrivalMode {
	if (enemyId === "wake-scrappers-hut") return "resident"
	if (wave > 0) return "phaseJump"
	if (enemyId === "mine-layer" || enemyId === "breach-crawler") {
		return "resident"
	}
	return index === 0 || rng.nextBool(0.5) ? "resident" : "phaseJump"
}

function selectTemplateId(kind: RoomFloorKind, degree: number, seed: number) {
	const variants = kind === "combat" ? 4 : 2
	return `${kind}-${Math.min(6, Math.max(1, degree))}-${Math.abs(seed) % variants + 1}`
}

function roomId(coord: HexCoord) {
	return `room-${coord.q}-${coord.r}`
}

function mixSeed(...values: number[]) {
	let hash = 2166136261
	for (const value of values) {
		hash ^= value | 0
		hash = Math.imul(hash, 16777619)
	}
	return Math.abs(hash || 1)
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, Math.floor(value)))
}
