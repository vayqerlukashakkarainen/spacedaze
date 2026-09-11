import assert from "node:assert/strict"
import { hexKey, hexNeighbors } from "../generation/hexUtils"
import { generateRoomFloor } from "../generation/rooms/roomFloorGenerator"
import { buildRoomTemplate } from "../generation/rooms/roomTemplateBuilder"
import { createRoomGroundPlatformCells } from "./roomGroundPlatforms"

let roomsWithPlatforms = 0

const serializedFloor = generateRoomFloor(8128, 1, { roomCount: 24 })
assert.deepEqual(
	serializedFloor,
	generateRoomFloor(8128, 1, { roomCount: 24 }),
	"Ground platforms should be deterministic"
)

for (let seed = 1; seed <= 80; seed++) {
	const floor = generateRoomFloor(seed, 1, { roomCount: 24 })
	for (const room of floor.rooms) {
		const template = buildRoomTemplate(room)
		const platforms = createRoomGroundPlatformCells(template, room)
		if ((room.environment?.groundPlatforms?.length ?? 0) === 0) {
			assert.equal(platforms.length, 0)
			continue
		}

		roomsWithPlatforms++
		assert(platforms.length >= 9, `${room.id} should render a useful ground island`)
		const keys = new Set(platforms.map((platform) => hexKey(platform.coord)))
		for (const platform of platforms) {
			const cell = template.map.getCell(platform.coord)
			assert(cell !== undefined && !cell.locked, `${room.id} places ground outside the room`)
			assert(!cell!.tags.has("room_door"), `${room.id} covers a door with ground`)
			assert(
				hexNeighbors(platform.coord).some((neighbor) => keys.has(hexKey(neighbor))),
				`${room.id} contains an isolated ground tile`
			)
			const expectedMask = hexNeighbors(platform.coord).reduce(
				(mask, neighbor, direction) =>
					keys.has(hexKey(neighbor)) ? mask : mask | (1 << direction),
				0
			)
			assert.equal(platform.exposedMask, expectedMask)
		}
	}
}

assert(roomsWithPlatforms > 0, "Generated rooms should contain resident ground")

console.log("Room ground platform tests passed")
