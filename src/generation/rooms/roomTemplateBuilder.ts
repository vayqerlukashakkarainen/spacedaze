import { GenerationMap, type GenCell } from "../generationTypes"
import { hexDistance, hexKey, hexNeighbors, type HexCoord } from "../hexUtils"
import { SeededRNG } from "../seededRng"
import type { RoomFloorRoom } from "./roomFloorTypes"

export const ROOM_CELL_RADIUS = 6
export const ROOM_CELL_DIAMETER = ROOM_CELL_RADIUS * 2 + 1

const DIRECTIONS: HexCoord[] = [
	{ q: 1, r: 0 },
	{ q: 1, r: -1 },
	{ q: 0, r: -1 },
	{ q: -1, r: 0 },
	{ q: -1, r: 1 },
	{ q: 0, r: 1 },
]

export interface BuiltRoomTemplate {
	map: GenerationMap
	center: HexCoord
	doors: RoomDoor[]
	spawnSlots: HexCoord[]
	contentSlots: HexCoord[]
}

export interface RoomDoor {
	direction: number
	destinationRoomId: string
	coord: HexCoord
	insideCoord: HexCoord
}

export function buildRoomTemplate(room: RoomFloorRoom): BuiltRoomTemplate {
	const size = ROOM_CELL_DIAMETER
	const center = { q: ROOM_CELL_RADIUS, r: ROOM_CELL_RADIUS }
	const map = new GenerationMap(size, size)
	const connectionByDirection = getConnectionDirections(room)
	const rng = new SeededRNG(room.seed)

	for (let q = 0; q < size; q++) {
		for (let r = 0; r < size; r++) {
			const coord = { q, r }
			const distance = hexDistance(coord, center)
			const cell = createCell(coord, distance >= ROOM_CELL_RADIUS)
			if (distance > ROOM_CELL_RADIUS) cell.locked = true
			map.setCell(coord, cell)
		}
	}

	const doors: RoomDoor[] = []
	for (const [direction, destinationRoomId] of connectionByDirection) {
		const vector = DIRECTIONS[direction]
		const doorCoord = addScaled(center, vector, ROOM_CELL_RADIUS)
		const insideCoord = addScaled(center, vector, ROOM_CELL_RADIUS - 1)
		const doorCell = map.getCell(doorCoord)
		if (doorCell) {
			doorCell.solid = false
			doorCell.locked = false
			doorCell.tags.add("room_door")
			doorCell.tags.add(`room_door_${direction}`)
		}
		const insideCell = map.getCell(insideCoord)
		insideCell?.tags.add("room_door_approach")
		doors.push({ direction, destinationRoomId, coord: doorCoord, insideCoord })
	}

	const protectedCells = createProtectedCells(center, doors)
	placeRoomObstacles(map, room, protectedCells, rng)
	const spawnSlots = selectSlots(map, center, protectedCells, room.seed ^ 0x51f15e, 8, 2, false, 1)
	const contentSlots = selectSlots(map, center, protectedCells, room.seed ^ 0xc012e, 5, 1)
	map.getCell(center)?.tags.add("player_spawn")
	for (const coord of spawnSlots) map.getCell(coord)?.tags.add("enemy_spawn")
	for (const coord of contentSlots) map.getCell(coord)?.tags.add("content_spawn")

	return { map, center, doors, spawnSlots, contentSlots }
}

export function getRoomDirection(from: HexCoord, to: HexCoord) {
	const delta = { q: to.q - from.q, r: to.r - from.r }
	return DIRECTIONS.findIndex((direction) =>
		direction.q === delta.q && direction.r === delta.r
	)
}

export function oppositeRoomDirection(direction: number) {
	return (direction + 3) % 6
}

function getConnectionDirections(room: RoomFloorRoom) {
	return room.connections
		.map((destinationRoomId) => {
			const destinationCoord = parseRoomId(destinationRoomId)
			return [getRoomDirection(room.coord, destinationCoord), destinationRoomId] as const
		})
		.filter(([direction]) => direction >= 0)
		.sort(([a], [b]) => a - b)
}

function parseRoomId(id: string): HexCoord {
	const match = /^room-(-?\d+)-(-?\d+)$/.exec(id)
	if (!match) throw new Error(`Invalid room id: ${id}`)
	return { q: Number(match[1]), r: Number(match[2]) }
}

function createCell(coord: HexCoord, solid: boolean): GenCell {
	return {
		coord,
		solid,
		hardness: solid ? 1 : 0,
		density: solid ? 1 : 0,
		regionId: solid ? -1 : 0,
		tags: new Set(),
		locked: false,
	}
}

function createProtectedCells(center: HexCoord, doors: RoomDoor[]) {
	const protectedCells = new Set<string>()
	protectedCells.add(hexKey(center))
	for (const door of doors) {
		const vector = DIRECTIONS[door.direction]
		for (let distance = 0; distance <= ROOM_CELL_RADIUS; distance++) {
			const corridor = addScaled(center, vector, distance)
			protectedCells.add(hexKey(corridor))
			for (const neighbor of hexNeighbors(corridor)) {
				if (hexDistance(neighbor, corridor) <= 1) protectedCells.add(hexKey(neighbor))
			}
		}
	}
	return protectedCells
}

function placeRoomObstacles(
	map: GenerationMap,
	room: RoomFloorRoom,
	protectedCells: Set<string>,
	rng: SeededRNG
) {
	if (room.kind !== "combat" && room.kind !== "event") return
	const candidates = map.getAllCells().filter((cell) =>
		!cell.solid &&
		hexDistance(cell.coord, { q: ROOM_CELL_RADIUS, r: ROOM_CELL_RADIUS }) >= 2 &&
		!protectedCells.has(hexKey(cell.coord))
	)
	rng.shuffle(candidates)
	const variant = Math.abs(room.seed) % 4
	const obstacleCount = 3 + variant
	for (const cell of candidates.slice(0, obstacleCount)) {
		cell.solid = true
		cell.hardness = 0.7
		cell.density = 0.8
		cell.tags.add("room_obstacle")
	}
}

function selectSlots(
	map: GenerationMap,
	center: HexCoord,
	protectedCells: Set<string>,
	seed: number,
	count: number,
	minimumDistance: number,
	excludeProtected: boolean = true,
	slotSpacing: number = 2
) {
	const rng = new SeededRNG(seed)
	const candidates = map.getAllCells().filter((cell) =>
		!cell.solid &&
		hexDistance(cell.coord, center) >= minimumDistance &&
		hexDistance(cell.coord, center) <= ROOM_CELL_RADIUS - 2 &&
		(!excludeProtected || !protectedCells.has(hexKey(cell.coord)))
	)
	rng.shuffle(candidates)
	const selected: HexCoord[] = []
	for (const candidate of candidates) {
		if (selected.some((coord) => hexDistance(coord, candidate.coord) < slotSpacing)) continue
		selected.push({ ...candidate.coord })
		if (selected.length >= count) break
	}
	return selected
}

function addScaled(coord: HexCoord, direction: HexCoord, scale: number) {
	return {
		q: coord.q + direction.q * scale,
		r: coord.r + direction.r * scale,
	}
}
