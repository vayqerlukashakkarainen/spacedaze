import {
	hexDistance,
	hexKey,
	hexNeighbors,
	type HexCoord,
} from "../generation/hexUtils"
import { getRoomCellRadius } from "../generation/rooms/roomTemplateBuilder"
import type { BuiltRoomTemplate } from "../generation/rooms/roomTemplateBuilder"
import type { RoomFloorRoom } from "../generation/rooms/roomFloorTypes"
import { SeededRNG } from "../generation/seededRng"
import {
	RUN_ROCK_GROUND_MATERIALS,
	RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL,
} from "./runRockGroundTiles"

export interface RoomGroundCell {
	coord: HexCoord
	variation: number
}

export function createRoomGroundCells(
	template: BuiltRoomTemplate,
	room: RoomFloorRoom
): RoomGroundCell[] {
	const roomRadius = getRoomCellRadius(room)
	const eligibleCells = template.map.getAllCells()
		.filter((cell) =>
			!cell.locked && (
				hexDistance(cell.coord, template.center) < roomRadius ||
				cell.tags.has("room_door")
			)
		)
	const eligibleByKey = new Map(
		eligibleCells.map((cell) => [hexKey(cell.coord), cell])
	)
	const selectedKeys = new Set<string>()
	const rng = new SeededRNG(room.seed ^ 0x6f12ab)
	const material = Math.abs(room.seed * 31) % RUN_ROCK_GROUND_MATERIALS

	const select = (coord: HexCoord) => {
		const key = hexKey(coord)
		if (eligibleByKey.has(key)) selectedKeys.add(key)
	}

	select(template.center)
	for (const cell of eligibleCells) {
		if (cell.tags.has("room_stamp") && !cell.solid) select(cell.coord)
	}
	for (const door of template.doors) {
		let cursor = { ...door.coord }
		select(cursor)
		while (hexDistance(cursor, template.center) > 0) {
			const currentDistance = hexDistance(cursor, template.center)
			const inwardNeighbors = hexNeighbors(cursor).filter((neighbor) =>
				eligibleByKey.has(hexKey(neighbor)) &&
				hexDistance(neighbor, template.center) < currentDistance
			)
			if (inwardNeighbors.length === 0) break
			cursor = { ...rng.choice(inwardNeighbors) }
			select(cursor)
		}
	}

	const coverage = 0.42 + rng.nextFloat() * 0.18
	const targetCount = Math.max(
		selectedKeys.size,
		Math.round(eligibleCells.length * coverage)
	)
	const frontier = new Set<string>()
	const addFrontier = (coord: HexCoord) => {
		for (const neighbor of hexNeighbors(coord)) {
			const key = hexKey(neighbor)
			if (eligibleByKey.has(key) && !selectedKeys.has(key)) frontier.add(key)
		}
	}
	for (const key of selectedKeys) addFrontier(eligibleByKey.get(key)!.coord)

	while (selectedKeys.size < targetCount && frontier.size > 0) {
		const candidates = [...frontier]
		const key = candidates[rng.nextInt(0, candidates.length)]
		frontier.delete(key)
		selectedKeys.add(key)
		addFrontier(eligibleByKey.get(key)!.coord)
	}

	return eligibleCells
		.filter((cell) => selectedKeys.has(hexKey(cell.coord)))
		.map((cell) => {
			return {
				coord: { ...cell.coord },
				variation: material * RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL + Math.abs(
					room.seed + cell.coord.q * 73 + cell.coord.r * 151
				) % RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL,
			}
		})
		.sort((a, b) => a.coord.r - b.coord.r || a.coord.q - b.coord.q)
}
