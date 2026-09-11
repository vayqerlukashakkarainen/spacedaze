import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import { getWakeEnvironmentPropProfile } from "../../content/environment/wakeEnvironmentCatalog"
import {
	hexDistance,
	hexKey,
	hexNeighbors,
	rotateHexCoord,
	type HexCoord,
} from "../hexUtils"
import { SeededRNG } from "../seededRng"
import type {
	RoomEnvironmentArchetypeId,
	RoomEnvironmentCategory,
	RoomEnvironmentObjectPlan,
	RoomEnvironmentPlan,
	RoomFloorRoom,
	RoomGroundPlatformPlan,
	RoomScrapFieldPlan,
} from "./roomFloorTypes"
import {
	getRoomProtectedCellKeys,
	ROOM_CELL_RADIUS,
} from "./roomTemplateBuilder"

interface PlacementRequest {
	archetypeId: RoomEnvironmentArchetypeId
	category: RoomEnvironmentCategory
	count: number
	health?: number
}

const CENTER = { q: ROOM_CELL_RADIUS, r: ROOM_CELL_RADIUS }

export function planRoomEnvironment(
	room: RoomFloorRoom,
	themeId: FloorThemeId,
	subfloor = 1
): RoomEnvironmentPlan {
	if (themeId !== "wake-scrap-district") return { objects: [] }
	const wakeSubfloor = Math.max(1, Math.min(5, Math.floor(subfloor)))
	const rng = new SeededRNG(room.seed ^ 0x45f19)
	const groundPlatforms = planGroundPlatforms(room)
	const scrapFields = planScrapFields(room, rng, wakeSubfloor)
	const reserved = new Set(scrapFields.flatMap((field) => [
		hexKey(field.center),
		...field.scrap.map((piece) => hexKey(piece.coord)),
	]))
	const barrelCluster = planVolatileCluster(room, rng, reserved, wakeSubfloor)
	for (const barrel of barrelCluster) reserved.add(hexKey(barrel.coord))
	const requests = getWakePlacementRequests(room, rng, wakeSubfloor)
	const candidates = getPlacementCandidates(room, rng, wakeSubfloor).filter(
		(coord) => !reserved.has(hexKey(coord))
	)
	const selected: HexCoord[] = scrapFields.flatMap((field) => [
		field.center,
		...field.scrap.map((piece) => piece.coord),
	])
	const objects: RoomEnvironmentObjectPlan[] = [...barrelCluster]

	for (const request of requests) {
		for (let index = 0; index < request.count; index++) {
			const candidateIndex = candidates.findIndex((candidate) =>
				selected.every((coord) => hexDistance(coord, candidate) >= 2)
			)
			if (candidateIndex < 0) break
			const [coord] = candidates.splice(candidateIndex, 1)
			selected.push(coord)
			objects.push({
				id: `${room.id}-environment-${objects.length}`,
				archetypeId: request.archetypeId,
				category: request.category,
				coord: { ...coord },
				orientation: rng.nextInt(0, 6),
				variant: rng.nextInt(0, getVariantCount(request.archetypeId)),
				health: request.health,
			})
		}
	}

	return { objects, groundPlatforms, scrapFields }
}

function planGroundPlatforms(room: RoomFloorRoom): RoomGroundPlatformPlan[] {
	const rng = new SeededRNG(room.seed ^ 0x67a91)
	const targetSize = getGroundPlatformSize(room, rng)
	const cells = new Map<string, HexCoord>([[hexKey(CENTER), { ...CENTER }]])

	while (cells.size < targetSize) {
		const frontier = new Map<string, HexCoord>()
		for (const cell of cells.values()) {
			for (const neighbor of hexNeighbors(cell)) {
				const key = hexKey(neighbor)
				if (
					cells.has(key) ||
					hexDistance(neighbor, CENTER) > 3 ||
					!isInteriorCoord(neighbor)
				) continue
				frontier.set(key, neighbor)
			}
		}
		const candidates = [...frontier.values()].map((coord) => ({
			coord,
			neighbors: hexNeighbors(coord).filter((neighbor) =>
				cells.has(hexKey(neighbor))
			).length,
		}))
		if (candidates.length === 0) break
		const preferredNeighborCount = rng.nextBool(0.58) ? 1 : 2
		const preferred = candidates.filter((candidate) =>
			candidate.neighbors === preferredNeighborCount
		)
		const pool = preferred.length > 0 ? preferred : candidates
		const selected = rng.choice(pool).coord
		cells.set(hexKey(selected), selected)
	}

	const rotation = rng.nextInt(0, 6)
	const rotatedCells = [...cells.values()]
		.map((coord) => {
			const offset = rotateHexCoord({
				q: coord.q - CENTER.q,
				r: coord.r - CENTER.r,
			}, rotation)
			return { q: CENTER.q + offset.q, r: CENTER.r + offset.r }
		})
		.sort((a, b) => a.r - b.r || a.q - b.q)

	return [{
		id: `${room.id}-ground-platform-0`,
		style: "wake-rock",
		cells: rotatedCells,
	}]
}

function getGroundPlatformSize(room: RoomFloorRoom, rng: SeededRNG) {
	if (room.kind === "boss") return rng.nextInt(18, 23)
	if (room.kind === "miniBoss") return rng.nextInt(15, 20)
	if (room.kind === "combat" || room.kind === "event") return rng.nextInt(12, 18)
	return rng.nextInt(9, 14)
}

function planVolatileCluster(
	room: RoomFloorRoom,
	rng: SeededRNG,
	reserved: ReadonlySet<string>,
	subfloor: number
): RoomEnvironmentObjectPlan[] {
	if (
		room.kind !== "combat" ||
		room.distanceFromStart < 1 ||
		!rng.nextBool(0.3)
	) return []
	const protectedCells = getRoomProtectedCellKeys(room, CENTER)
	const anchors = rng.shuffle(getInteriorCoords().filter((coord) =>
		hexDistance(coord, CENTER) >= 2 &&
		!protectedCells.has(hexKey(coord)) &&
		!reserved.has(hexKey(coord))
	))
	for (const anchor of anchors) {
		const neighbors = rng.shuffle(hexNeighbors(anchor).filter((coord) =>
			isInteriorCoord(coord) &&
			!protectedCells.has(hexKey(coord)) &&
			!reserved.has(hexKey(coord))
		))
		const coords = [anchor, ...neighbors.slice(0, rng.nextInt(2, 4))]
		if (coords.length < 3) continue
		const archetypeId = getWakeVolatileArchetype(subfloor, rng)
		const profile = getWakeEnvironmentPropProfile(archetypeId)
		return coords.map((coord, index) => ({
			id: `${room.id}-barrel-cluster-${index}`,
			archetypeId,
			category: "volatile",
			coord: { ...coord },
			orientation: rng.nextInt(0, 6),
			variant: 0,
			health: profile?.health ?? 9,
		}))
	}
	return []
}

function planScrapFields(
	room: RoomFloorRoom,
	rng: SeededRNG,
	subfloor: number
): RoomScrapFieldPlan[] {
	if (
		room.kind !== "combat" ||
		room.distanceFromStart < 1 ||
		!rng.nextBool([0.2, 0.46, 0.24, 0.18, 0.34][subfloor - 1] ?? 0.32)
	) return []
	const protectedCells = getRoomProtectedCellKeys(room, CENTER)
	const centers = rng.shuffle(getInteriorCoords().filter((coord) => {
		if (
			hexDistance(coord, CENTER) < 2 ||
			hexDistance(coord, CENTER) > 3 ||
			protectedCells.has(hexKey(coord))
		) return false
		return hexNeighbors(coord).every((neighbor) =>
			isInteriorCoord(neighbor) &&
			!protectedCells.has(hexKey(neighbor))
		)
	}))
	const center = centers[0]
	if (!center) return []
	const fieldSeed = room.seed ^ center.q * 193 ^ center.r * 389 ^ 0x5ca9
	return [{
		id: `${room.id}-scrap-field-0`,
		center: { ...center },
		seed: fieldSeed,
		rewardTier: Math.min(3, 1 + Math.floor(room.distanceFromStart / 3)),
		scrap: hexNeighbors(center).map((coord, index) => ({
			id: `${room.id}-scrap-field-0-piece-${index}`,
			coord: { ...coord },
			orientation: rng.nextInt(0, 6),
			variant: rng.nextInt(0, 20),
		})),
	}]
}

function getInteriorCoords() {
	const coords: HexCoord[] = []
	for (let q = 0; q < ROOM_CELL_RADIUS * 2 + 1; q++) {
		for (let r = 0; r < ROOM_CELL_RADIUS * 2 + 1; r++) {
			const coord = { q, r }
			if (isInteriorCoord(coord)) coords.push(coord)
		}
	}
	return coords
}

function isInteriorCoord(coord: HexCoord) {
	return coord.q >= 0 &&
		coord.r >= 0 &&
		coord.q < ROOM_CELL_RADIUS * 2 + 1 &&
		coord.r < ROOM_CELL_RADIUS * 2 + 1 &&
		hexDistance(coord, CENTER) < ROOM_CELL_RADIUS
}

function getWakePlacementRequests(
	room: RoomFloorRoom,
	rng: SeededRNG,
	subfloor: number
): PlacementRequest[] {
	if (room.kind === "chill" || room.kind === "start") {
		return [
			{
				archetypeId: "wake-memory-console",
				category: "destructible-cover",
				count: 1,
				health: getWakeEnvironmentPropProfile("wake-memory-console")?.health,
			},
			...getWakeStructuralCoverRequests(1, rng, subfloor),
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: 1,
				health: 18,
			},
		]
	}
	if (room.kind === "combat") {
		const trapRequest = getWakeTrapPlacementRequest(room, rng)
		const teslaRequest = getWakeTeslaPlacementRequest(room, rng)
		const volatileArchetype = getWakeVolatileArchetype(subfloor, rng)
		const volatileProfile = getWakeEnvironmentPropProfile(volatileArchetype)
		return [
			...getWakeStructuralCoverRequests(
				rng.nextInt(2 + Math.floor(subfloor / 3), 4 + Math.floor(subfloor / 2)),
				rng,
				subfloor
			),
			...(trapRequest ? [trapRequest] : []),
			...(teslaRequest ? [teslaRequest] : []),
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: rng.nextInt(1, 3),
				health: 18,
			},
			{
				archetypeId: volatileArchetype,
				category: "volatile",
				count: rng.nextBool(0.7 + subfloor * 0.04) ? 1 : 0,
				health: volatileProfile?.health ?? 9,
			},
		]
	}
	if (room.kind === "miniBoss") {
		const volatileArchetype = getWakeVolatileArchetype(subfloor, rng)
		return [
			...getWakeStructuralCoverRequests(3 + Math.floor(subfloor / 2), rng, subfloor),
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: 2,
				health: 24,
			},
			{
				archetypeId: volatileArchetype,
				category: "volatile",
				count: 1,
				health: getWakeEnvironmentPropProfile(volatileArchetype)?.health,
			},
		]
	}
	if (room.kind === "boss") {
		if (room.bossId === "wake-yardmaster") {
			return [
				...getWakeStructuralCoverRequests(6, rng, subfloor),
				{
					archetypeId: "wake-floating-scrap",
					category: "dynamic-cover",
					count: 3,
					health: 24,
				},
				{
					archetypeId: getWakePrimaryVolatileArchetype(subfloor),
					category: "volatile",
					count: 2,
					health: getWakeEnvironmentPropProfile(
						getWakePrimaryVolatileArchetype(subfloor)
					)?.health,
				},
			]
		}
		if (room.bossId === "wake-last-beacon") {
			return [
				...getWakeStructuralCoverRequests(4, rng, subfloor),
				{
					archetypeId: "wake-floating-scrap",
					category: "dynamic-cover",
					count: 2,
					health: 22,
				},
			]
		}
		return [
			...getWakeStructuralCoverRequests(3, rng, subfloor),
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: 2,
				health: 22,
			},
		]
	}
	return []
}

const WAKE_DESTRUCTIBLE_COVER_ARCHETYPES: readonly RoomEnvironmentArchetypeId[] = [
	"wake-hull-barricade",
	"wake-salvage-cluster",
	"wake-cable-reel",
	"wake-pipe-manifold",
]

const WAKE_SUBFLOOR_COVER_ARCHETYPES: Record<
	number,
	readonly RoomEnvironmentArchetypeId[]
> = {
	1: WAKE_DESTRUCTIBLE_COVER_ARCHETYPES,
	2: [
		"wake-hull-barricade",
		"wake-cable-reel",
		"wake-pipe-manifold",
		"wake-salvage-cluster",
	],
	3: [
		"wake-sorting-gantry",
		"wake-pipe-manifold",
		"wake-cable-reel",
		"wake-hull-barricade",
	],
	4: [
		"wake-patchwork-stall",
		"wake-signal-nest",
		"wake-salvage-cluster",
		"wake-memory-console",
	],
	5: [
		"wake-breaker-crusher",
		"wake-pipe-manifold",
		"wake-sorting-gantry",
		"wake-hull-barricade",
	],
}

function getWakeStructuralCoverRequests(
	count: number,
	rng: SeededRNG,
	subfloor: number
): PlacementRequest[] {
	const pool = WAKE_SUBFLOOR_COVER_ARCHETYPES[subfloor] ??
		WAKE_DESTRUCTIBLE_COVER_ARCHETYPES
	const shuffled = rng.shuffle([...pool])
	return Array.from({ length: count }, (_, index) => ({
		archetypeId: shuffled[index % shuffled.length],
		category: "destructible-cover" as const,
		count: 1,
		health: getWakeEnvironmentPropProfile(
			shuffled[index % shuffled.length]
		)?.health,
	}))
}

function getWakePrimaryVolatileArchetype(
	subfloor: number
): RoomEnvironmentArchetypeId {
	if (subfloor === 2) return "wake-pressure-tank"
	if (subfloor === 3) return "wake-battery-bank"
	if (subfloor === 4) return "wake-coolant-canister"
	if (subfloor >= 5) return "wake-reactor-pod"
	return "wake-fuel-cell"
}

function getWakeVolatileArchetype(
	subfloor: number,
	rng: SeededRNG
): RoomEnvironmentArchetypeId {
	const primary = getWakePrimaryVolatileArchetype(subfloor)
	return subfloor > 1 && rng.nextBool(0.2) ? "wake-fuel-cell" : primary
}

function getWakeTeslaPlacementRequest(
	room: RoomFloorRoom,
	rng: SeededRNG
): PlacementRequest | undefined {
	if (room.distanceFromStart < 1 || !rng.nextBool(0.28)) return undefined
	return {
		archetypeId: "wake-tesla-coil",
		category: "trap",
		count: 1,
	}
}

function getWakeTrapPlacementRequest(
	room: RoomFloorRoom,
	rng: SeededRNG
): PlacementRequest | undefined {
	if (room.distanceFromStart < 2 || !rng.nextBool(0.72)) return undefined
	return {
		archetypeId: rng.nextBool(0.5)
			? "wake-concussion-plate"
			: "wake-slowdown-plate",
		category: "trap",
		count: room.distanceFromStart >= 7 && rng.nextBool(0.25) ? 2 : 1,
	}
}

function getPlacementCandidates(
	room: RoomFloorRoom,
	rng: SeededRNG,
	subfloor: number
) {
	const protectedCells = getRoomProtectedCellKeys(room, CENTER)
	const candidates: HexCoord[] = []
	for (let q = 0; q < ROOM_CELL_RADIUS * 2 + 1; q++) {
		for (let r = 0; r < ROOM_CELL_RADIUS * 2 + 1; r++) {
			const coord = { q, r }
			const distance = hexDistance(coord, CENTER)
			if (
				distance < 2 ||
				distance > ROOM_CELL_RADIUS - 2 ||
				protectedCells.has(hexKey(coord))
			) continue
			candidates.push(coord)
		}
	}
	const randomized = rng.shuffle(candidates).map((coord, index) => ({ coord, index }))
	return randomized.sort((a, b) =>
		getSubfloorPlacementScore(a.coord, subfloor) -
		getSubfloorPlacementScore(b.coord, subfloor) ||
		a.index - b.index
	).map(({ coord }) => coord)
}

function getSubfloorPlacementScore(coord: HexCoord, subfloor: number) {
	const distance = hexDistance(coord, CENTER)
	if (subfloor === 2) {
		return Math.min(
			Math.abs(coord.q - CENTER.q),
			Math.abs(coord.r - CENTER.r),
			Math.abs(coord.q + coord.r - CENTER.q - CENTER.r)
		)
	}
	if (subfloor === 3) {
		return Math.min(
			Math.abs(Math.abs(coord.q - CENTER.q) - 2),
			Math.abs(Math.abs(coord.r - CENTER.r) - 2)
		)
	}
	if (subfloor === 4) {
		return Math.abs(coord.q - CENTER.q - 2) +
			Math.abs(coord.r - CENTER.r + 1)
	}
	if (subfloor >= 5) return Math.abs(distance - 3)
	return 0
}

function getVariantCount(archetypeId: RoomEnvironmentArchetypeId) {
	if (archetypeId === "wake-floating-scrap") return 20
	return 1
}
