import assert from "node:assert/strict"
import { hexDistance, hexKey } from "../generation/hexUtils"
import { generateRoomFloor } from "../generation/rooms/roomFloorGenerator"
import {
	buildRoomTemplate,
	getRoomCellRadius,
} from "../generation/rooms/roomTemplateBuilder"
import {
	RUN_ROCK_GROUND_TILE_VARIANTS,
	RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL,
} from "./runRockGroundTiles"
import {
	createRoomWallBackfillCells,
	ROOM_WALL_BACKFILL_DEPTH,
} from "./roomWallBackfill"

for (let seed = 1; seed <= 40; seed++) {
	const room = generateRoomFloor(seed, 1, { roomCount: 12 }).rooms[0]
	const template = buildRoomTemplate(room)
	const roomRadius = getRoomCellRadius(room)
	const cells = createRoomWallBackfillCells(template, room)
	const keys = new Set(cells.map((cell) => hexKey(cell.coord)))

	assert.deepEqual(
		createRoomWallBackfillCells(template, room),
		cells,
		`${room.id} wall backfill should be deterministic`
	)
	assert(cells.length > 0, `${room.id} needs wall backfill cells`)
	assert(cells.every((cell) => {
		const distance = hexDistance(cell.coord, template.center)
		return distance >= roomRadius &&
			distance <= roomRadius + ROOM_WALL_BACKFILL_DEPTH
	}), `${room.id} wall backfill escaped its outer shell`)
	assert(cells.every((cell) =>
		cell.variation >= 0 && cell.variation < RUN_ROCK_GROUND_TILE_VARIANTS
	), `${room.id} wall backfill referenced an invalid atlas frame`)
	assert(new Set(cells.map((cell) =>
		Math.floor(cell.variation / RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL)
	)).size > 1, `${room.id} wall backfill needs multiple material families`)

	for (const door of template.doors) {
		const direction = {
			q: door.coord.q - door.insideCoord.q,
			r: door.coord.r - door.insideCoord.r,
		}
		for (
			let distance = roomRadius;
			distance <= roomRadius + ROOM_WALL_BACKFILL_DEPTH;
			distance++
		) {
			assert(!keys.has(hexKey({
				q: template.center.q + direction.q * distance,
				r: template.center.r + direction.r * distance,
			})), `${room.id} wall backfill blocked a door passage`)
		}
	}
}

console.log("Room wall backfill tests passed")
