import {
	beginRoomFloor,
	clearRoomFloor,
	enterFloorRoom,
	getCurrentFloorRoom,
	getRoomFloorSnapshot,
	markFloorEnemyDefeated,
} from "./roomFloorService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const floor = beginRoomFloor(38191, 2, { roomCount: 12 })
const start = getCurrentFloorRoom()!
assert(start.kind === "start", "A room floor must begin in its start room")
const neighbor = floor.rooms.find((room) => start.connections.includes(room.id))!
assert(enterFloorRoom(neighbor.id)?.id === neighbor.id, "A connected room should be enterable")
assert(getCurrentFloorRoom()?.id === neighbor.id, "The current room should change")
assert(enterFloorRoom(floor.exitRoomId) === undefined, "Disconnected rooms should not be enterable")
assert(start.state === "cleared", "Leaving a safe start room should clear it")
assert(
	neighbor.connections.every((id) => floor.rooms.find((room) => room.id === id)?.state !== "unseen"),
	"Entering a room should discover its neighbors"
)

const combatFloor = beginRoomFloor(9341, 1, { roomCount: 10 })
const combat = combatFloor.rooms.find((room) => room.kind === "combat")!
const route = routeBetween(combatFloor.startRoomId, combat.id, combatFloor.rooms)
for (const roomId of route.slice(1)) enterFloorRoom(roomId)
for (const enemy of combat.encounter!.enemies) {
	assert(markFloorEnemyDefeated(enemy.id), `Enemy ${enemy.id} should be defeated once`)
}
assert(getCurrentFloorRoom()?.state === "cleared", "Defeating a manifest should clear its room")
const snapshot = getRoomFloorSnapshot()!
snapshot.rooms[0].connections.length = 0
assert(combatFloor.rooms[0].connections.length > 0, "Snapshots must not mutate runtime state")

clearRoomFloor()
assert(getCurrentFloorRoom() === undefined, "Clearing a floor should remove its state")

function routeBetween(
	startId: string,
	targetId: string,
	rooms: Array<{ id: string; connections: string[] }>
) {
	const previous = new Map<string, string>()
	const visited = new Set([startId])
	const queue = [startId]
	while (queue.length > 0) {
		const id = queue.shift()!
		if (id === targetId) break
		const room = rooms.find((candidate) => candidate.id === id)!
		for (const neighbor of room.connections) {
			if (visited.has(neighbor)) continue
			visited.add(neighbor)
			previous.set(neighbor, id)
			queue.push(neighbor)
		}
	}
	const route = [targetId]
	while (route[0] !== startId) route.unshift(previous.get(route[0])!)
	return route
}

console.log("Room floor state tests passed")
