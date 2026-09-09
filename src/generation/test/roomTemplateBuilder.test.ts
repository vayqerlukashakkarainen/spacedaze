import { hexDistance, hexKey, hexNeighbors } from "../hexUtils"
import { generateRoomFloor } from "../rooms/roomFloorGenerator"
import {
	buildRoomTemplate,
	getRoomDirection,
	ROOM_CELL_RADIUS,
} from "../rooms/roomTemplateBuilder"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

for (let seed = 1; seed <= 100; seed++) {
	const floor = generateRoomFloor(seed, seed % 6 + 1)
	for (const room of floor.rooms) {
		const template = buildRoomTemplate(room)
		assert(template.doors.length === room.connections.length, `${room.id} lost a connection`)
		assert(template.spawnSlots.length >= 4, `${room.id} needs at least four enemy sockets`)
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
			if (object.category !== "structural") {
				assert(!cell!.solid, `${object.id} should remain traversable`)
			}
		}
		for (const door of template.doors) {
			const cell = template.map.getCell(door.coord)
			assert(cell !== undefined && !cell.solid, `${room.id} door is blocked`)
			assert(hexDistance(door.coord, template.center) === ROOM_CELL_RADIUS, `${room.id} door is off the boundary`)
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
