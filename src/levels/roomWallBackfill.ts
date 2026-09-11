import { hexDistance, hexKey, type HexCoord } from "../generation/hexUtils"
import {
	getRoomCellRadius,
	type BuiltRoomTemplate,
} from "../generation/rooms/roomTemplateBuilder"
import type { RoomFloorRoom } from "../generation/rooms/roomFloorTypes"
import { RUN_ROCK_GROUND_TILE_VARIANTS } from "./runRockGroundTiles"

export const ROOM_WALL_BACKFILL_DEPTH = 4

export interface RoomWallBackfillCell {
	coord: HexCoord
	variation: number
}

export function createRoomWallBackfillCells(
	template: BuiltRoomTemplate,
	room: RoomFloorRoom
): RoomWallBackfillCell[] {
	const roomRadius = getRoomCellRadius(room)
	const outerRadius = roomRadius + ROOM_WALL_BACKFILL_DEPTH
	const passageKeys = getDoorPassageKeys(template, roomRadius, outerRadius)
	const cells: RoomWallBackfillCell[] = []

	for (
		let q = template.center.q - outerRadius;
		q <= template.center.q + outerRadius;
		q++
	) {
		for (
			let r = template.center.r - outerRadius;
			r <= template.center.r + outerRadius;
			r++
		) {
			const coord = { q, r }
			const distance = hexDistance(coord, template.center)
			if (distance < roomRadius || distance > outerRadius) continue
			if (passageKeys.has(hexKey(coord))) continue
			cells.push({
				coord,
				variation: getBackfillVariation(room.seed, coord),
			})
		}
	}

	return cells.sort((a, b) =>
		a.coord.r - b.coord.r || a.coord.q - b.coord.q
	)
}

function getDoorPassageKeys(
	template: BuiltRoomTemplate,
	roomRadius: number,
	outerRadius: number
) {
	const passageKeys = new Set<string>()
	for (const door of template.doors) {
		const direction = {
			q: door.coord.q - door.insideCoord.q,
			r: door.coord.r - door.insideCoord.r,
		}
		for (let distance = roomRadius; distance <= outerRadius; distance++) {
			passageKeys.add(hexKey({
				q: template.center.q + direction.q * distance,
				r: template.center.r + direction.r * distance,
			}))
		}
	}
	return passageKeys
}

function getBackfillVariation(seed: number, coord: HexCoord) {
	const hash = Math.imul(seed ^ 0x4b1d, 31) +
		Math.imul(coord.q, 73) +
		Math.imul(coord.r, 151)
	return Math.abs(hash) % RUN_ROCK_GROUND_TILE_VARIANTS
}
