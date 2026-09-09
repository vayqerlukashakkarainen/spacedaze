import { generateRoomFloor } from "../rooms/roomFloorGenerator"
import { hexKey, hexNeighbors } from "../hexUtils"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

function serialize(seed: number, depth: number) {
	return JSON.stringify(generateRoomFloor(seed, depth))
}

assert(
	serialize(8128, 4) === serialize(8128, 4),
	"A floor seed must produce the same graph and encounters"
)
assert(
	serialize(8128, 4) !== serialize(8129, 4),
	"Different floor seeds should produce different floors"
)

for (let seed = 1; seed <= 200; seed++) {
	const depth = seed % 8 + 1
	const floor = generateRoomFloor(seed, depth, {
		milestoneBoss: depth % 3 === 0,
	})
	assert(floor.rooms.length >= 10 && floor.rooms.length <= 16, `Seed ${seed} has invalid room count`)
	const ids = new Set(floor.rooms.map((room) => room.id))
	assert(ids.size === floor.rooms.length, `Seed ${seed} has duplicate room ids`)
	assert(floor.rooms.some((room) => room.kind === "reward"), `Seed ${seed} has no reward room`)
	assert(floor.rooms.filter((room) => room.kind === "shop").length === 1, `Seed ${seed} needs one shop room`)
	const lockedRooms = floor.rooms.filter((room) => room.keyRequired)
	assert(lockedRooms.length === 2, `Seed ${seed} needs two locked rooms`)
	assert(
		lockedRooms.every((room) => room.kind === "reward" || room.kind === "shop"),
		`Seed ${seed} locks a non-treasure room`
	)
	assert(
		hasRouteAvoidingRooms(floor.startRoomId, floor.exitRoomId, floor.rooms, new Set(
			lockedRooms.map((room) => room.id)
		)),
		`Seed ${seed} requires a key to reach its exit`
	)
	assert(floor.rooms.filter((room) => room.kind === "miniBoss").length === 1, `Seed ${seed} needs one mini-boss room`)
	assert(!floor.rooms.some((room) => String(room.kind) === "repair"), `Seed ${seed} contains a removed repair room`)
	assert(floor.rooms.filter((room) => room.kind === "gravity").length === 2, `Seed ${seed} needs two gravity rooms`)
	const exit = floor.rooms.find((room) => room.id === floor.exitRoomId)
	assert(exit !== undefined, `Seed ${seed} has no exit room`)
	assert(exit!.kind === (depth % 3 === 0 ? "boss" : "exit"), `Seed ${seed} has wrong exit kind`)
	const maxDistance = Math.max(...floor.rooms.map((room) => room.distanceFromStart))
	assert(exit!.distanceFromStart === maxDistance, `Seed ${seed} exit is not farthest from start`)
	const roomByCoord = new Map(floor.rooms.map((room) => [hexKey(room.coord), room]))
	const connectionCount = floor.rooms.reduce(
		(total, room) => total + room.connections.length,
		0
	) / 2
	assert(
		connectionCount >= floor.rooms.length,
		`Seed ${seed} should contain an alternate room connection`
	)
	assert(
		floor.rooms.filter((room) => room.connections.length >= 3).length >= 2,
		`Seed ${seed} should contain multiple junction rooms`
	)

	for (const room of floor.rooms) {
		for (const neighborCoord of hexNeighbors(room.coord)) {
			const adjacentRoom = roomByCoord.get(hexKey(neighborCoord))
			if (!adjacentRoom) continue
			assert(
				room.connections.includes(adjacentRoom.id),
				`${room.id} should connect to adjacent ${adjacentRoom.id}`
			)
		}
		for (const neighborId of room.connections) {
			const neighbor = floor.rooms.find((candidate) => candidate.id === neighborId)
			assert(neighbor !== undefined, `${room.id} links to missing room ${neighborId}`)
			assert(neighbor!.connections.includes(room.id), `${room.id} connection is not bidirectional`)
		}
		if (room.kind === "shrine") {
			assert(room.encounter === undefined, `${room.id} should activate its shrine directly`)
			continue
		}
		if (!["combat", "reward", "gravity", "event"].includes(room.kind)) continue
		assert(room.encounter !== undefined, `${room.id} has no encounter plan`)
		assert(room.encounter!.enemies.length > 0, `${room.id} has no planned enemies`)
		const enemyIds = new Set(room.encounter!.enemies.map((enemy) => enemy.id))
		assert(enemyIds.size === room.encounter!.enemies.length, `${room.id} has duplicate enemy ids`)
	}
}

const shallowFloor = generateRoomFloor(777, 1, { roomCount: 16 })
const deepFloor = generateRoomFloor(777, 8, { roomCount: 16 })
const averageTier = (floor: ReturnType<typeof generateRoomFloor>) => {
	const encounters = floor.rooms.flatMap((room) => room.encounter ? [room.encounter] : [])
	return encounters.reduce((total, encounter) => total + encounter.tier, 0) / encounters.length
}
assert(
	averageTier(deepFloor) > averageTier(shallowFloor),
	"Deeper floors should pre-generate harder encounters"
)

function hasRouteAvoidingRooms(
	startId: string,
	targetId: string,
	rooms: Array<{ id: string; connections: string[] }>,
	blocked: Set<string>
) {
	const visited = new Set<string>([...blocked, startId])
	const queue = [startId]
	while (queue.length > 0) {
		const roomId = queue.shift()!
		if (roomId === targetId) return true
		const room = rooms.find((candidate) => candidate.id === roomId)!
		for (const neighborId of room.connections) {
			if (visited.has(neighborId)) continue
			visited.add(neighborId)
			queue.push(neighborId)
		}
	}
	return false
}

console.log("Room floor generator tests passed")
