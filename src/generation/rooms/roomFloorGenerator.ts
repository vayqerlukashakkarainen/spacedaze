import {
	createSimulatedEncounterEnemies,
	selectEncounterDefinition,
} from "../../services/enemyEncounterCatalogService"
import {
	isEnemyProgressionUnlocked,
	type ProgressionEnemyId,
} from "../../services/enemyProgressionService"
import { hexDistance, hexKey, hexNeighbors, type HexCoord } from "../hexUtils"
import { SeededRNG } from "../seededRng"
import { getFloorThemeIdForDepth } from "../../levels/floorThemes/floorThemeDirectory"
import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import { createWakeEncounterEnemies } from "../../services/wakeEncounterService"
import type {
	RoomEncounterPlan,
	RoomFloor,
	RoomFloorGenerationOptions,
	RoomFloorKind,
	RoomFloorRoom,
} from "./roomFloorTypes"

const MIN_ROOMS = 10
const MAX_ROOMS = 16
const MAX_ROOM_DEGREE = 4
const ELITE_CHANCE_BY_TIER = [0, 0.04, 0.08, 0.15, 0.24, 0.34]

export function generateRoomFloor(
	seed: number,
	depth: number,
	options: RoomFloorGenerationOptions = {}
): RoomFloor {
	const normalizedDepth = Math.max(1, Math.floor(depth))
	const targetCount = clamp(
		options.roomCount ?? 10 + Math.floor((normalizedDepth - 1) * 0.75),
		MIN_ROOMS,
		MAX_ROOMS
	)
	const rng = new SeededRNG(mixSeed(seed, normalizedDepth, 701))
	const coords = growRoomGraph(targetCount, rng)
	const connections = connectAdjacentRooms(coords)
	const distances = calculateDistances(coords, connections)
	const exitIndex = selectFarthestRoom(coords, distances)
	const kinds = assignRoomKinds(
		coords,
		connections,
		distances,
		exitIndex,
		options.milestoneBoss === true,
		rng
	)
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
			contentCompleted: false,
			keyRequired: kind === "reward" || kind === "shop",
			keyUnlocked: false,
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

	return {
		seed,
		depth: normalizedDepth,
		themeId,
		startRoomId: rooms[0].id,
		exitRoomId: rooms[exitIndex].id,
		currentRoomId: rooms[0].id,
		keys: 0,
		rooms,
	}
}

function growRoomGraph(targetCount: number, rng: SeededRNG) {
	const coords: HexCoord[] = [{ q: 0, r: 0 }]
	const occupied = new Set([hexKey(coords[0])])
	const degrees = [0]

	while (coords.length < targetCount) {
		const parentCandidates = coords
			.map((coord, index) => ({ coord, index }))
			.filter(({ coord, index }) =>
				degrees[index] < MAX_ROOM_DEGREE &&
				hexNeighbors(coord).some((neighbor) => !occupied.has(hexKey(neighbor)))
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
			hexNeighbors(parent.coord).filter((neighbor) => !occupied.has(hexKey(neighbor)))
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
	rng: SeededRNG
) {
	const kinds = coords.map((): RoomFloorKind => "combat")
	kinds[0] = "start"
	kinds[exitIndex] = milestoneBoss ? "boss" : "exit"
	const candidates = coords
		.map((_, index) => index)
		.filter((index) => index !== 0 && index !== exitIndex)
	const deadEnds = candidates
		.filter((index) => connections[index].length === 1)
		.sort((a, b) => distances[b] - distances[a])
	const used = new Set([0, exitIndex])
	const optionalLockedRooms = candidates.filter((index) =>
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
	const support = takeRoom(false)
	if (support !== undefined) kinds[support] = rng.choice(["health", "shrine"])
	const gravityA = takeRoom(true)
	const gravityB = takeRoom(false)
	if (gravityA !== undefined && gravityB !== undefined) {
		kinds[gravityA] = "gravity"
		kinds[gravityB] = "gravity"
	}
	const miniBoss = takeRoom(true)
	if (miniBoss !== undefined) kinds[miniBoss] = "miniBoss"
	if (coords.length >= 13) {
		const event = takeRoom(false)
		if (event !== undefined) kinds[event] = "event"
	}
	return kinds
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
		kind === "event"
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
		? createWakeEncounterEnemies(tier, random)
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
		enemies: enemyIds.map((enemyId, index) => ({
			id: `enemy-${seed}-${index}`,
			enemyId,
			wave: Math.floor(index / maxWaveSize),
			spawnSlot: index % maxWaveSize,
			elite: tier >= 2 && rng.nextBool(ELITE_CHANCE_BY_TIER[tier]),
			defeated: false,
		})),
	}
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
