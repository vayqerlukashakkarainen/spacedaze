import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import { hexDistance, hexKey, type HexCoord } from "../hexUtils"
import { SeededRNG } from "../seededRng"
import type {
	RoomEnvironmentArchetypeId,
	RoomEnvironmentCategory,
	RoomEnvironmentObjectPlan,
	RoomEnvironmentPlan,
	RoomFloorRoom,
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
	themeId: FloorThemeId
): RoomEnvironmentPlan {
	if (themeId !== "wake-scrap-district") return { objects: [] }
	const rng = new SeededRNG(room.seed ^ 0x45f19)
	const requests = getWakePlacementRequests(room, rng)
	const candidates = getPlacementCandidates(room, rng)
	const selected: HexCoord[] = []
	const objects: RoomEnvironmentObjectPlan[] = []

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

	return { objects }
}

function getWakePlacementRequests(
	room: RoomFloorRoom,
	rng: SeededRNG
): PlacementRequest[] {
	if (room.kind === "start") {
		return [
			{
				archetypeId: "wake-hull-barricade",
				category: "structural",
				count: 1,
			},
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
		return [
			{
				archetypeId: "wake-hull-barricade",
				category: "structural",
				count: rng.nextInt(2, 4),
			},
			...(trapRequest ? [trapRequest] : []),
			...(teslaRequest ? [teslaRequest] : []),
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: rng.nextInt(1, 3),
				health: 18,
			},
			{
				archetypeId: "wake-fuel-cell",
				category: "volatile",
				count: rng.nextBool(0.7) ? 1 : 0,
				health: 9,
			},
		]
	}
	if (room.kind === "miniBoss") {
		return [
			{
				archetypeId: "wake-hull-barricade",
				category: "structural",
				count: 3,
			},
			{
				archetypeId: "wake-floating-scrap",
				category: "dynamic-cover",
				count: 2,
				health: 24,
			},
			{
				archetypeId: "wake-fuel-cell",
				category: "volatile",
				count: 1,
				health: 12,
			},
		]
	}
	return []
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

function getPlacementCandidates(room: RoomFloorRoom, rng: SeededRNG) {
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
	return rng.shuffle(candidates)
}

function getVariantCount(archetypeId: RoomEnvironmentArchetypeId) {
	if (archetypeId === "wake-floating-scrap") return 20
	return 1
}
