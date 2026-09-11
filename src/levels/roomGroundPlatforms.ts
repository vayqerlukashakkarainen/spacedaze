import { hexKey, hexNeighbors, type HexCoord } from "../generation/hexUtils"
import type { BuiltRoomTemplate } from "../generation/rooms/roomTemplateBuilder"
import type { RoomFloorRoom } from "../generation/rooms/roomFloorTypes"

export interface RoomGroundPlatformCell {
	coord: HexCoord
	exposedMask: number
	variation: number
}

export function createRoomGroundPlatformCells(
	template: BuiltRoomTemplate,
	room: RoomFloorRoom
): RoomGroundPlatformCell[] {
	const groundByKey = new Map<string, HexCoord>()
	for (const platform of room.environment?.groundPlatforms ?? []) {
		for (const coord of platform.cells) {
			if (!canRenderGroundAt(template, coord)) continue
			groundByKey.set(hexKey(coord), { ...coord })
		}
	}
	const groundKeys = new Set(groundByKey.keys())
	return [...groundByKey.values()]
		.map((coord) => {
			const exposedMask = hexNeighbors(coord).reduce(
				(mask, neighbor, direction) =>
					groundKeys.has(hexKey(neighbor))
						? mask
						: mask | (1 << direction),
				0
			)
			return {
				coord,
				exposedMask,
				variation: Math.abs(room.seed + coord.q * 73 + coord.r * 151) % 4,
			}
		})
		.sort((a, b) => a.coord.r - b.coord.r || a.coord.q - b.coord.q)
}

function canRenderGroundAt(template: BuiltRoomTemplate, coord: HexCoord) {
	const cell = template.map.getCell(coord)
	return cell !== undefined &&
		!cell.locked &&
		!cell.tags.has("room_door") &&
		!cell.tags.has("room_door_approach")
}
