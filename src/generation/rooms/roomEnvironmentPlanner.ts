import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import { getWakeEnvironmentPropProfile } from "../../content/environment/wakeEnvironmentCatalog"
import {
	hexDistance,
	hexKey,
	hexNeighbors,
	type HexCoord,
} from "../hexUtils"
import { SeededRNG } from "../seededRng"
import type {
	RoomEnvironmentArchetypeId,
	RoomEnvironmentCategory,
	RoomEnvironmentObjectPlan,
	RoomEnvironmentPlan,
	RoomFloorRoom,
	RoomScrapFieldPlan,
} from "./roomFloorTypes"
import {
	getRoomProtectedCellKeys,
	getRoomCellRadius,
	getRoomCenter,
	getRoomUsableAreaScale,
} from "./roomTemplateBuilder"
import {
	getRoomStampPlans,
	getRoomStampReservedCellKeys,
} from "./roomStampPlanner"

interface PlacementRequest {
	archetypeId: RoomEnvironmentArchetypeId
	category: RoomEnvironmentCategory
	count: number
	health?: number
}

export function planRoomEnvironment(
	room: RoomFloorRoom,
	themeId: FloorThemeId,
	subfloor = 1
): RoomEnvironmentPlan {
	if (themeId !== "wake-scrap-district") return { objects: [] }
	const center = getRoomCenter(room)
	const radius = getRoomCellRadius(room)
	const wakeSubfloor = Math.max(1, Math.min(5, Math.floor(subfloor)))
	const rng = new SeededRNG(room.seed ^ 0x45f19)
	const hasStamp = getRoomStampPlans(room).length > 0
	const scrapFields = hasStamp
		? []
		: planScrapFields(room, rng, wakeSubfloor, center, radius)
	const reserved = getRoomStampReservedCellKeys(room, center)
	for (const key of scrapFields.flatMap((field) => [
		hexKey(field.center),
		...field.scrap.map((piece) => hexKey(piece.coord)),
	])) reserved.add(key)
	const barrelCluster = hasStamp
		? []
		: planVolatileCluster(room, rng, reserved, wakeSubfloor, center, radius)
	for (const barrel of barrelCluster) reserved.add(hexKey(barrel.coord))
	const requests = scalePlacementRequests(
		getWakePlacementRequests(room, rng, wakeSubfloor),
		getRoomUsableAreaScale(room)
	)
	const candidates = getPlacementCandidates(
		room,
		rng,
		wakeSubfloor,
		center,
		radius
	).filter(
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

	return { objects, scrapFields }
}

function planVolatileCluster(
	room: RoomFloorRoom,
	rng: SeededRNG,
	reserved: ReadonlySet<string>,
	subfloor: number,
	center: HexCoord,
	radius: number
): RoomEnvironmentObjectPlan[] {
	if (
		room.kind !== "combat" ||
		room.distanceFromStart < 1 ||
		!rng.nextBool(0.3)
	) return []
	const protectedCells = getRoomProtectedCellKeys(room, center)
	const anchors = rng.shuffle(getInteriorCoords(center, radius).filter((coord) =>
		hexDistance(coord, center) >= 2 &&
		!protectedCells.has(hexKey(coord)) &&
		!reserved.has(hexKey(coord))
	))
	for (const anchor of anchors) {
		const neighbors = rng.shuffle(hexNeighbors(anchor).filter((coord) =>
			isInteriorCoord(coord, center, radius) &&
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
	subfloor: number,
	center: HexCoord,
	radius: number
): RoomScrapFieldPlan[] {
	if (
		room.kind !== "combat" ||
		room.distanceFromStart < 1 ||
		!rng.nextBool([0.2, 0.46, 0.24, 0.18, 0.34][subfloor - 1] ?? 0.32)
	) return []
	const protectedCells = getRoomProtectedCellKeys(room, center)
	const centers = rng.shuffle(getInteriorCoords(center, radius).filter((coord) => {
		if (
			hexDistance(coord, center) < 2 ||
			hexDistance(coord, center) > Math.max(3, radius - 2) ||
			protectedCells.has(hexKey(coord))
		) return false
		return hexNeighbors(coord).every((neighbor) =>
			isInteriorCoord(neighbor, center, radius) &&
			!protectedCells.has(hexKey(neighbor))
		)
	}))
	const fieldCenter = centers[0]
	if (!fieldCenter) return []
	const fieldSeed = room.seed ^ fieldCenter.q * 193 ^ fieldCenter.r * 389 ^ 0x5ca9
	return [{
		id: `${room.id}-scrap-field-0`,
		center: { ...fieldCenter },
		seed: fieldSeed,
		rewardTier: Math.min(3, 1 + Math.floor(room.distanceFromStart / 3)),
		scrap: hexNeighbors(fieldCenter).map((coord, index) => ({
			id: `${room.id}-scrap-field-0-piece-${index}`,
			coord: { ...coord },
			orientation: rng.nextInt(0, 6),
			variant: rng.nextInt(0, 20),
		})),
	}]
}

function getInteriorCoords(center: HexCoord, radius: number) {
	const coords: HexCoord[] = []
	for (let q = 0; q < radius * 2 + 1; q++) {
		for (let r = 0; r < radius * 2 + 1; r++) {
			const coord = { q, r }
			if (isInteriorCoord(coord, center, radius)) coords.push(coord)
		}
	}
	return coords
}

function isInteriorCoord(coord: HexCoord, center: HexCoord, radius: number) {
	return coord.q >= 0 &&
		coord.r >= 0 &&
		coord.q < radius * 2 + 1 &&
		coord.r < radius * 2 + 1 &&
		hexDistance(coord, center) < radius
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

function scalePlacementRequests(
	requests: PlacementRequest[],
	areaScale: number
) {
	const densityScale = 1 + Math.max(0, areaScale - 1) * 0.65
	return requests.map((request) => ({
		...request,
		count: request.count === 0
			? 0
			: Math.max(1, Math.round(request.count * densityScale)),
	}))
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
	subfloor: number,
	center: HexCoord,
	radius: number
) {
	const protectedCells = getRoomProtectedCellKeys(room, center)
	const candidates: HexCoord[] = []
	for (let q = 0; q < radius * 2 + 1; q++) {
		for (let r = 0; r < radius * 2 + 1; r++) {
			const coord = { q, r }
			const distance = hexDistance(coord, center)
			if (
				distance < 2 ||
				distance > radius - 2 ||
				protectedCells.has(hexKey(coord))
			) continue
			candidates.push(coord)
		}
	}
	const randomized = rng.shuffle(candidates).map((coord, index) => ({ coord, index }))
	return randomized.sort((a, b) =>
		getSubfloorPlacementScore(a.coord, subfloor, center, radius) -
		getSubfloorPlacementScore(b.coord, subfloor, center, radius) ||
		a.index - b.index
	).map(({ coord }) => coord)
}

function getSubfloorPlacementScore(
	coord: HexCoord,
	subfloor: number,
	center: HexCoord,
	radius: number
) {
	const distance = hexDistance(coord, center)
	if (subfloor === 2) {
		return Math.min(
			Math.abs(coord.q - center.q),
			Math.abs(coord.r - center.r),
			Math.abs(coord.q + coord.r - center.q - center.r)
		)
	}
	if (subfloor === 3) {
		return Math.min(
			Math.abs(Math.abs(coord.q - center.q) - 2),
			Math.abs(Math.abs(coord.r - center.r) - 2)
		)
	}
	if (subfloor === 4) {
		return Math.abs(coord.q - center.q - 2) +
			Math.abs(coord.r - center.r + 1)
	}
	if (subfloor >= 5) return Math.abs(distance - Math.max(3, radius - 3))
	return 0
}

function getVariantCount(archetypeId: RoomEnvironmentArchetypeId) {
	if (archetypeId === "wake-floating-scrap") return 20
	return 1
}
