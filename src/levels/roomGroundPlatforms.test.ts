import assert from "node:assert/strict"
import { hexDistance, hexKey, hexNeighbors } from "../generation/hexUtils"
import { generateRoomFloor } from "../generation/rooms/roomFloorGenerator"
import {
	buildRoomTemplate,
	getRoomCellRadius,
} from "../generation/rooms/roomTemplateBuilder"
import { createRoomGroundCells } from "./roomGroundPlatforms"
import {
	RUN_ROCK_GROUND_TILE_VARIANTS,
	RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL,
} from "./runRockGroundTiles"

for (let seed = 1; seed <= 80; seed++) {
	const floor = generateRoomFloor(seed, 1, { roomCount: 24 })
	for (const room of floor.rooms) {
		const template = buildRoomTemplate(room)
		const roomRadius = getRoomCellRadius(room)
		const groundCells = createRoomGroundCells(template, room)
		const eligibleGround = template.map.getAllCells().filter((cell) =>
			!cell.locked && (
				hexDistance(cell.coord, template.center) < roomRadius ||
				cell.tags.has("room_door")
			)
		)
		assert(
			groundCells.length < eligibleGround.length,
			`${room.id} ground should leave open space in the room`
		)
		assert(
			groundCells.length >= Math.floor(eligibleGround.length * 0.4),
			`${room.id} ground shape should remain substantial`
		)
		assert.deepEqual(
			createRoomGroundCells(template, room),
			groundCells,
			`${room.id} ground shape should be deterministic`
		)
		const materialFamilies = new Set(
			groundCells.map((cell) =>
				Math.floor(cell.variation / RUN_ROCK_GROUND_VARIANTS_PER_MATERIAL)
			)
		)
		assert.equal(
			materialFamilies.size,
			1,
			`${room.id} should use one coherent ground material family`
		)
		assert(
			groundCells.every((cell) =>
				cell.variation >= 0 &&
				cell.variation < RUN_ROCK_GROUND_TILE_VARIANTS
			),
			`${room.id} should only reference frames in the ground atlas`
		)
		const keys = new Set(groundCells.map((cell) => hexKey(cell.coord)))
		if (room.kind === "deposit") {
			const relayCells = template.map.getAllCells().filter((cell) =>
				cell.tags.has("room_stamp_salvage-relay") && !cell.solid
			)
			assert.equal(relayCells.length, 19, `${room.id} needs the full relay footprint`)
			assert(
				relayCells.every((cell) => keys.has(hexKey(cell.coord))),
				`${room.id} should place the salvage relay entirely on ground`
			)
		}
		const visited = new Set<string>()
		const pending = [groundCells[0].coord]
		while (pending.length > 0) {
			const coord = pending.pop()!
			const key = hexKey(coord)
			if (visited.has(key)) continue
			visited.add(key)
			for (const neighbor of hexNeighbors(coord)) {
				if (keys.has(hexKey(neighbor))) pending.push(neighbor)
			}
		}
		assert.equal(
			visited.size,
			groundCells.length,
			`${room.id} ground layer should form one connected structure`
		)
		for (const groundCell of groundCells) {
			const cell = template.map.getCell(groundCell.coord)
			assert(cell !== undefined && !cell.locked, `${room.id} places ground outside the room`)
			assert(
				hexNeighbors(groundCell.coord).some((neighbor) => keys.has(hexKey(neighbor))),
				`${room.id} contains an isolated ground tile`
			)
		}
		for (const door of template.doors) {
			assert(keys.has(hexKey(door.coord)), `${room.id} doorway should continue the ground`)
		}
	}
}

console.log("Room ground layer tests passed")
