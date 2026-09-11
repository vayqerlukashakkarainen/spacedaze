import { hexDistance, hexKey, hexNeighbors } from "../hexUtils"
import { generateRoomFloor } from "../rooms/roomFloorGenerator"
import {
	buildRoomTemplate,
	getRoomCellRadius,
	getRoomDirection,
} from "../rooms/roomTemplateBuilder"
import { getRoomStampDefinition } from "../../stamps/roomStampCatalog"
import { getRoomStampPlans } from "../rooms/roomStampPlanner"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

for (let seed = 1; seed <= 100; seed++) {
	const floor = generateRoomFloor(seed, seed % 6 + 1)
	for (const room of floor.rooms) {
		const template = buildRoomTemplate(room)
		const roomRadius = getRoomCellRadius(room)
		assert(template.doors.length === room.connections.length, `${room.id} lost a connection`)
		assert(template.spawnSlots.length >= 4, `${room.id} needs at least four enemy sockets`)
		for (const stampPlan of getRoomStampPlans(room)) {
			const stamp = getRoomStampDefinition(stampPlan.stampId)
			assert(
				template.spawnSlots.length >= stamp.validation.minimumSpawnSlots,
				`${room.id} does not preserve the stamp's enemy socket budget`
			)
			assert(
				template.map.getAllCells().some((cell) =>
					cell.tags.has(`room_stamp_${stampPlan.stampId}`)
				),
				`${room.id} did not apply its stamp geometry`
			)
		}
		for (const object of room.environment?.objects ?? []) {
			const cell = template.map.getCell(object.coord)
			assert(cell !== undefined, `${object.id} is outside the room map`)
			assert(
				cell!.tags.has("room_environment_object"),
				`${object.id} was not applied to the room template`
			)
			assert(
				!template.spawnSlots.some((slot) => hexKey(slot) === hexKey(object.coord)),
				`${object.id} overlaps an enemy spawn slot`
			)
			assert(
				!template.contentSlots.some((slot) => hexKey(slot) === hexKey(object.coord)),
				`${object.id} overlaps a content spawn slot`
			)
			assert(
				!cell!.solid,
				`${object.id} should not replace hex-grid terrain solidity`
			)
		}
		for (const field of room.environment?.scrapFields ?? []) {
			const centerCell = template.map.getCell(field.center)
			assert(centerCell !== undefined && !centerCell.solid, `${field.id} reward cell is blocked`)
			assert(
				!template.spawnSlots.some((slot) => hexKey(slot) === hexKey(field.center)) &&
				!template.contentSlots.some((slot) => hexKey(slot) === hexKey(field.center)),
				`${field.id} reward cell overlaps generated content`
			)
			for (const piece of field.scrap) {
				const cell = template.map.getCell(piece.coord)
				assert(cell !== undefined && cell.solid, `${piece.id} is not impassable`)
				assert(
					cell!.tags.has("room_scrap_field") &&
					cell!.tags.has("room_environment_structural"),
					`${piece.id} is missing scrap-field terrain tags`
				)
				assert(
					!template.spawnSlots.some((slot) => hexKey(slot) === hexKey(piece.coord)) &&
					!template.contentSlots.some((slot) => hexKey(slot) === hexKey(piece.coord)),
					`${piece.id} overlaps generated content`
				)
			}
		}
		for (const door of template.doors) {
			const cell = template.map.getCell(door.coord)
			assert(cell !== undefined && !cell.solid, `${room.id} door is blocked`)
			assert(hexDistance(door.coord, template.center) === roomRadius, `${room.id} door is off the boundary`)
			const destination = floor.rooms.find((candidate) => candidate.id === door.destinationRoomId)!
			assert(getRoomDirection(room.coord, destination.coord) === door.direction, `${room.id} door points the wrong way`)
			assert(hasOpenPath(template, door.coord), `${room.id} door has no path to center`)
		}
	}
}

function hasOpenPath(
	template: ReturnType<typeof buildRoomTemplate>,
	target: { q: number; r: number }
) {
	const visited = new Set([hexKey(template.center)])
	const queue = [template.center]
	while (queue.length > 0) {
		const coord = queue.shift()!
		if (hexKey(coord) === hexKey(target)) return true
		for (const neighbor of hexNeighbors(coord)) {
			if (visited.has(hexKey(neighbor))) continue
			const cell = template.map.getCell(neighbor)
			if (!cell || cell.solid) continue
			visited.add(hexKey(neighbor))
			queue.push(neighbor)
		}
	}
	return false
}

console.log("Room template builder tests passed")
