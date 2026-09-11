import {
	getRoomStampDefinition,
	ROOM_STAMP_CATALOG,
} from "../../stamps/roomStampCatalog"
import type {
	RoomStampDefinition,
	RoomStampEnemySpawnerSlot,
} from "../../stamps/roomStampTypes"
import {
	getCompatibleCombatSpawnerProfiles,
	type CombatSpawnerProfile,
} from "../../stamps/combat/combatSpawnerProfileCatalog"
import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import type { GenerationMap } from "../generationTypes"
import {
	hexDistance,
	hexKey,
	rotateHexCoord,
	type HexCoord,
} from "../hexUtils"
import { SeededRNG } from "../seededRng"
import type {
	RoomEnemyPlan,
	RoomFloorRoom,
	RoomStampId,
	RoomStampPlan,
	RoomStampResolvedContentPlan,
} from "./roomFloorTypes"
import { getRoomCellRadius, getRoomCenter } from "./roomTemplateBuilder"

const STAMP_CHANCE = 0.42
const OVERLAY_STAMP_CHANCE = 0.58
const MAX_OVERLAY_STAMPS = 2

interface StampCandidate {
	definition: RoomStampDefinition
	rotations: number[]
}

const pickWeightedStampCandidate = (
	candidates: StampCandidate[],
	rng: SeededRNG
) => {
	const weighted = candidates.flatMap((candidate) =>
		Array.from(
			{ length: Math.max(1, Math.round(candidate.definition.selection.weight * 10)) },
			() => candidate
		)
	)
	return rng.choice(weighted)
}

const ROOM_DIRECTIONS: readonly HexCoord[] = [
	{ q: 1, r: 0 },
	{ q: 1, r: -1 },
	{ q: 0, r: -1 },
	{ q: -1, r: 0 },
	{ q: -1, r: 1 },
	{ q: 0, r: 1 },
]

export function assignRoomStamps(
	rooms: RoomFloorRoom[],
	themeId: FloorThemeId,
	subfloor: number
) {
	const roomById = new Map(rooms.map((room) => [room.id, room]))
	const stampHistory: RoomStampId[] = []
	const orderedRooms = [...rooms].sort((a, b) =>
		a.distanceFromStart - b.distanceFromStart ||
		a.id.localeCompare(b.id)
	)

	for (const room of orderedRooms) {
		room.stamp = undefined
		room.stamps = undefined
		const rng = new SeededRNG(room.seed ^ 0x537a6d70)
		const center = getRoomCenter(room)
		const connectionDirections = getConnectionDirections(room)
		const compatibleCandidates = Object.values(ROOM_STAMP_CATALOG).map((definition) => ({
			definition,
			rotations: getCompatibleRotations(
				definition,
				room,
				themeId,
				subfloor,
				connectionDirections
			),
		})).filter(({ definition, rotations }) =>
			definition.mode === "primary" &&
			rotations.length > 0 &&
			canResolveRoomStampContent(definition, room, themeId)
		)
		const requiredCandidates = compatibleCandidates.filter(
			({ definition }) => definition.selection.required === true
		)
		if (requiredCandidates.length === 0 && !rng.nextBool(STAMP_CHANCE)) continue
		const candidates = requiredCandidates.length > 0
			? requiredCandidates
			: compatibleCandidates.filter(({ definition }) =>
			!stampHistory.slice(-definition.selection.repeatCooldown)
				.includes(definition.id) &&
			!room.connections.some((neighborId) =>
				getRoomStampPlans(roomById.get(neighborId)).some((stamp) =>
					stamp.stampId === definition.id
				)
			)
			)
		if (candidates.length === 0) continue

		const selected = pickWeightedStampCandidate(candidates, rng)
		const primary = createRoomStampPlan(room, selected, rng, 0)
		primary.resolvedContent = resolveRoomStampContent(
			room,
			selected.definition,
			primary.rotation,
			center,
			themeId
		)
		const plans = [primary]
		const occupiedLocalCells = getStampLocalCellKeys(
			selected.definition,
			primary.rotation
		)
		for (let overlayIndex = 0; overlayIndex < MAX_OVERLAY_STAMPS; overlayIndex++) {
			if (!rng.nextBool(OVERLAY_STAMP_CHANCE)) break
			const overlayCandidates = Object.values(ROOM_STAMP_CATALOG).map((definition) => ({
				definition,
				rotations: getCompatibleRotations(
					definition,
					room,
					themeId,
					subfloor,
					connectionDirections
				).filter((rotation) => !stampOverlaps(
					definition,
					rotation,
					occupiedLocalCells
				)),
			})).filter(({ definition, rotations }) =>
				definition.mode === "overlay" &&
				rotations.length > 0 &&
				canResolveRoomStampContent(definition, room, themeId) &&
				!plans.some((plan) => plan.stampId === definition.id) &&
				!stampHistory.slice(-definition.selection.repeatCooldown)
					.includes(definition.id) &&
				!room.connections.some((neighborId) =>
					getRoomStampPlans(roomById.get(neighborId)).some((stamp) =>
						stamp.stampId === definition.id
					)
				)
			)
			if (overlayCandidates.length === 0) break
			const overlay = pickWeightedStampCandidate(overlayCandidates, rng)
			const plan = createRoomStampPlan(room, overlay, rng, overlayIndex + 1)
			plan.resolvedContent = resolveRoomStampContent(
				room,
				overlay.definition,
				plan.rotation,
				center,
				themeId
			)
			plans.push(plan)
			for (const key of getStampLocalCellKeys(overlay.definition, plan.rotation)) {
				occupiedLocalCells.add(key)
			}
		}
		room.stamp = primary
		room.stamps = plans
		for (const plan of plans) stampHistory.push(plan.stampId)
	}
}

function createRoomStampPlan(
	room: RoomFloorRoom,
	candidate: StampCandidate,
	rng: SeededRNG,
	index: number
): RoomStampPlan {
	return {
		stampId: candidate.definition.id,
		rotation: rng.choice(candidate.rotations),
		mirrored: false,
		variantSeed: room.seed ^ 0x71a9 ^ Math.imul(index + 1, 0x1f123bb5),
		resolvedContent: [],
	}
}

function getStampLocalCellKeys(
	definition: RoomStampDefinition,
	rotation: number
) {
	const coords = [
		...definition.cells.map((cell) => cell.coord),
		...definition.mechanics.map((mechanic) => mechanic.coord),
		...definition.contentSlots.map((slot) => slot.coord),
	]
	return new Set(coords.map((coord) => hexKey(rotateHexCoord(coord, rotation))))
}

function stampOverlaps(
	definition: RoomStampDefinition,
	rotation: number,
	occupiedLocalCells: ReadonlySet<string>
) {
	return [...getStampLocalCellKeys(definition, rotation)].some((key) =>
		occupiedLocalCells.has(key)
	)
}

export function getRoomStampPlans(room?: RoomFloorRoom) {
	if (!room) return []
	if (room.stamps && room.stamps.length > 0) return room.stamps
	return room.stamp ? [room.stamp] : []
}

export function applyRoomStampGeometry(
	map: GenerationMap,
	room: RoomFloorRoom,
	center: HexCoord,
	protectedCells: ReadonlySet<string> = new Set()
) {
	for (const stamp of getRoomStampPlans(room)) {
		const definition = getRoomStampDefinition(stamp.stampId)
		for (const stampCell of definition.cells) {
		const coord = transformRoomStampCoord(
			center,
			stampCell.coord,
			stamp.rotation
		)
		const cell = map.getCell(coord)
		if (!cell || cell.locked || cell.tags.has("room_door")) continue
		if (
			stampCell.terrain === "wall" &&
			definition.validation.preserveDoorRoutes &&
			protectedCells.has(hexKey(coord))
		) continue
		cell.solid = stampCell.terrain === "wall"
		cell.hardness = cell.solid ? 1 : 0
		cell.density = cell.solid ? 1 : 0
		cell.regionId = cell.solid ? -1 : 0
		cell.tags.add("room_stamp")
		cell.tags.add(`room_stamp_${stamp.stampId}`)
		}
	}
}

export function getRoomStampReservedCellKeys(
	room: RoomFloorRoom,
	center: HexCoord
) {
	const reserved = new Set<string>()
	for (const stamp of getRoomStampPlans(room)) {
	const definition = getRoomStampDefinition(stamp.stampId)
	for (const cell of definition.cells) {
		reserved.add(hexKey(transformRoomStampCoord(
			center,
			cell.coord,
			stamp.rotation
		)))
	}
	for (const mechanic of definition.mechanics) {
		reserved.add(hexKey(transformRoomStampCoord(
			center,
			mechanic.coord,
			stamp.rotation
		)))
	}
	for (const slot of definition.contentSlots) {
		reserved.add(hexKey(transformRoomStampCoord(
			center,
			slot.coord,
			stamp.rotation
		)))
	}
	}
	return reserved
}

export function transformRoomStampCoord(
	center: HexCoord,
	localCoord: HexCoord,
	rotation: number
) {
	const rotated = rotateHexCoord(localCoord, rotation)
	return {
		q: center.q + rotated.q,
		r: center.r + rotated.r,
	}
}

export function getRoomStampWorldObjectCoord(
	room: RoomFloorRoom,
	center: HexCoord,
	objectId: "debris-deposit"
) {
	for (const stamp of getRoomStampPlans(room)) {
		const definition = getRoomStampDefinition(stamp.stampId)
		const anchor = definition.mechanics.find((mechanic) =>
			mechanic.type === "world-object-anchor" &&
			mechanic.objectId === objectId
		)
		if (anchor) {
			return transformRoomStampCoord(center, anchor.coord, stamp.rotation)
		}
	}
	return undefined
}

function getCompatibleRotations(
	definition: RoomStampDefinition,
	room: RoomFloorRoom,
	themeId: FloorThemeId,
	subfloor: number,
	connectionDirections: number[]
) {
	const compatibility = definition.compatibility
	const roomRadius = getRoomCellRadius(room)
	if (!compatibility.roomKinds.includes(room.kind)) return []
	if (
		compatibility.minimumRoomRadius !== undefined &&
		roomRadius < compatibility.minimumRoomRadius
	) return []
	if (
		compatibility.maximumRoomRadius !== undefined &&
		roomRadius > compatibility.maximumRoomRadius
	) return []
	if (compatibility.themes && !compatibility.themes.includes(themeId)) return []
	if (
		compatibility.minimumSubfloor !== undefined &&
		subfloor < compatibility.minimumSubfloor
	) return []
	if (
		compatibility.maximumSubfloor !== undefined &&
		subfloor > compatibility.maximumSubfloor
	) return []
	if (
		compatibility.minimumDistanceFromStart !== undefined &&
		room.distanceFromStart < compatibility.minimumDistanceFromStart
	) return []
	if (
		room.connections.length < compatibility.minimumConnections ||
		room.connections.length > compatibility.maximumConnections
	) return []

	return definition.selection.allowedRotations.filter((rotation) => {
		const footprint = [
			...definition.cells.map((cell) => cell.coord),
			...definition.mechanics.map((mechanic) => mechanic.coord),
			...definition.contentSlots.map((slot) => slot.coord),
		]
		if (footprint.some((coord) =>
			hexDistance(rotateHexCoord(coord, rotation), { q: 0, r: 0 }) >= roomRadius
		)) return false
		const ports = definition.ports.requiredDirections
			.map((direction) => (direction + rotation) % 6)
			.sort((a, b) => a - b)
		if (definition.ports.exact && ports.length !== connectionDirections.length) {
			return false
		}
		return ports.every((direction) => connectionDirections.includes(direction))
	})
}

function canResolveRoomStampContent(
	definition: RoomStampDefinition,
	room: RoomFloorRoom,
	themeId: FloorThemeId
) {
	return definition.contentSlots.every((slot) =>
		!slot.required ||
		getCompatibleCombatSpawnerProfiles(slot, room, themeId).length > 0
	)
}

function resolveRoomStampContent(
	room: RoomFloorRoom,
	definition: RoomStampDefinition,
	rotation: number,
	center: HexCoord,
	themeId: FloorThemeId
): RoomStampResolvedContentPlan[] {
	if (!room.encounter) return []
	const resolved: RoomStampResolvedContentPlan[] = []
	for (const slot of definition.contentSlots) {
		const profiles = getCompatibleCombatSpawnerProfiles(slot, room, themeId)
		if (profiles.length === 0) continue
		const rng = new SeededRNG(room.seed ^ hashString(slot.id) ^ 0x5a7e)
		const weighted = profiles.flatMap((profile) => {
			const alreadyPlanned = room.encounter!.enemies.some((enemy) =>
				enemy.enemyId === profile.enemyId && !enemy.defeated
			)
			const weight = profile.weight * (alreadyPlanned ? 2 : 1)
			return Array.from(
				{ length: Math.max(1, Math.round(weight * 10)) },
				() => profile
			)
		})
		const profile = rng.choice(weighted)
		const coord = transformRoomStampCoord(center, slot.coord, rotation)
		resolved.push({
			slotId: slot.id,
			kind: "enemy-spawner",
			profileId: profile.id,
			enemyId: profile.enemyId,
			coord: { ...coord },
			wave: slot.wave,
		})
		applySpawnerProfile(room, slot, coord, profile)
	}
	return resolved
}

function applySpawnerProfile(
	room: RoomFloorRoom,
	slot: RoomStampEnemySpawnerSlot,
	coord: HexCoord,
	profile: CombatSpawnerProfile
) {
	const encounter = room.encounter
	if (!encounter) return
	if (slot.encounterPolicy === "replace") encounter.enemies.length = 0
	const existingIndex = slot.encounterPolicy === "supplement"
		? -1
		: encounter.enemies.findIndex((enemy) =>
			enemy.enemyId === profile.enemyId && !enemy.defeated
		)
	let spawner: RoomEnemyPlan
	if (existingIndex >= 0) {
		spawner = encounter.enemies.splice(existingIndex, 1)[0]
		spawner.wave = slot.wave
		spawner.arrivalMode = "resident"
		spawner.spawnCoord = { ...coord }
	} else {
		spawner = {
			id: `${room.id}-stamp-${slot.id}-${profile.id}`,
			enemyId: profile.enemyId,
			wave: slot.wave,
			spawnSlot: 0,
			elite: false,
			defeated: false,
			arrivalMode: "resident",
			spawnCoord: { ...coord },
		}
	}
	encounter.enemies.unshift(spawner)
	ensureSpawnerCompanions(room, slot.id, slot.wave, profile)
}

function ensureSpawnerCompanions(
	room: RoomFloorRoom,
	slotId: string,
	wave: number,
	profile: CombatSpawnerProfile
) {
	const encounter = room.encounter
	const minimum = profile.minimumCompanions
	if (!encounter || !minimum) return
	const existingCount = encounter.enemies.filter((enemy) =>
		enemy.enemyId === minimum.enemyId && !enemy.defeated
	).length
	for (let index = existingCount; index < minimum.count; index++) {
		encounter.enemies.push({
			id: `${room.id}-stamp-${slotId}-companion-${index}`,
			enemyId: minimum.enemyId,
			wave,
			spawnSlot: index + 1,
			elite: false,
			defeated: false,
			arrivalMode: "resident",
		})
	}
}

function hashString(value: string) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash | 0
}

function getConnectionDirections(room: RoomFloorRoom) {
	return room.connections.map((roomId) => {
		const coord = parseRoomId(roomId)
		const q = coord.q - room.coord.q
		const r = coord.r - room.coord.r
		return ROOM_DIRECTIONS.findIndex((direction) =>
			direction.q === q && direction.r === r
		)
	}).filter((direction) => direction >= 0).sort((a, b) => a - b)
}

function parseRoomId(id: string): HexCoord {
	const match = /^room-(-?\d+)-(-?\d+)$/.exec(id)
	if (!match) throw new Error(`Invalid room id: ${id}`)
	return { q: Number(match[1]), r: Number(match[2]) }
}
