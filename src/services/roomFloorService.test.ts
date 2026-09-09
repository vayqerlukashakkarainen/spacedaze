import {
	addFloorKeys,
	beginRoomFloor,
	clearRoomFloor,
	discoverAllFloorRooms,
	enterFloorRoom,
	getCurrentFloorRoom,
	getFloorKeyCount,
	getRoomFloorSnapshot,
	isFloorRoomKeyLocked,
	markCurrentFloorRoomCleared,
	markFloorEnemyDefeated,
	rollCurrentRoomClearKeyDrop,
	rollFloorEnemyKeyDrop,
	teleportToFloorRoom,
	unlockFloorRoomWithKey,
} from "./roomFloorService"
import { RewardRarity } from "../types/rewardTypes"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const floor = beginRoomFloor(38191, 2, { roomCount: 12 })
const start = getCurrentFloorRoom()!
assert(start.kind === "start", "A room floor must begin in its start room")
const neighbor = floor.rooms.find((room) => start.connections.includes(room.id))!
assert(enterFloorRoom(neighbor.id) === undefined, "An active room should block its exits")
markCurrentFloorRoomCleared()
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
for (const roomId of route.slice(1)) {
	markCurrentFloorRoomCleared()
	enterFloorRoom(roomId)
}
const previousRoom = combat.connections[0]
assert(
	enterFloorRoom(previousRoom) === undefined,
	"An uncleared combat room should block backtracking"
)
for (const enemy of combat.encounter!.enemies) {
	assert(markFloorEnemyDefeated(enemy.id), `Enemy ${enemy.id} should be defeated once`)
}
assert(
	getCurrentFloorRoom()?.encounter?.enemies.every((enemy) => enemy.defeated) === true,
	"Defeating a manifest should persist every defeated enemy"
)
markCurrentFloorRoomCleared()
assert(
	enterFloorRoom(previousRoom)?.id === previousRoom,
	"Clearing a combat room should unlock its exits"
)
const snapshot = getRoomFloorSnapshot()!
snapshot.rooms[0].connections.length = 0
assert(combatFloor.rooms[0].connections.length > 0, "Snapshots must not mutate runtime state")
const environmentRoom = combatFloor.rooms.find(
	(room) => (room.environment?.objects.length ?? 0) > 0
)!
const environmentSnapshot = getRoomFloorSnapshot()!
environmentSnapshot.rooms.find((room) => room.id === environmentRoom.id)!
	.environment!.objects[0].destroyed = true
assert(
	environmentRoom.environment!.objects[0].destroyed !== true,
	"Environment state in snapshots must be isolated"
)
const shop = combatFloor.rooms.find((room) => room.kind === "shop")!
shop.shopOffers = [{
	rewardId: "upgrade:test:1",
	rarity: RewardRarity.Common,
	price: 10,
	purchased: false,
}]
const shopSnapshot = getRoomFloorSnapshot()!
shopSnapshot.rooms.find((room) => room.id === shop.id)!.shopOffers![0].purchased = true
assert(shop.shopOffers[0].purchased === false, "Shop offers in snapshots must be isolated")

const hiddenRoomCount = combatFloor.rooms.filter((room) =>
	room.state === "unseen" ||
	(room.state === "discovered" && room.mapIdentityRevealed !== true)
).length
assert(
	discoverAllFloorRooms() === hiddenRoomCount,
	"Revealing a floor should report every newly revealed room"
)
assert(
	combatFloor.rooms.every((room) => room.state !== "unseen"),
	"Revealing a floor should discover every unseen room"
)
assert(
	combatFloor.rooms.every((room) =>
		room.state !== "discovered" || room.mapIdentityRevealed === true
	),
	"Revealing a floor should show discovered room identities"
)
assert(
	getCurrentFloorRoom()?.state === "cleared",
	"Revealing a floor should preserve the current room state"
)

const jumpFloor = beginRoomFloor(58124, 2, { roomCount: 10 })
const jumpOrigin = getCurrentFloorRoom()!
const jumpDestination = jumpFloor.rooms.find((room) => room.id !== jumpOrigin.id)!
assert(
	teleportToFloorRoom(jumpDestination.id) === undefined,
	"Normal teleports should remain blocked while the origin room is active"
)
assert(
	teleportToFloorRoom(jumpDestination.id, true)?.id === jumpDestination.id,
	"Gravity jumps should allow travel while the origin room is active"
)
assert(
	jumpOrigin.state === "active",
	"Leaving an active gravity encounter should preserve its combat state"
)

const keyFloor = beginRoomFloor(47912, 3, { roomCount: 12 })
const lockedRoom = keyFloor.rooms.find((room) => room.keyRequired)!
const lockNeighbor = keyFloor.rooms.find(
	(room) => lockedRoom.connections.includes(room.id)
)!
keyFloor.currentRoomId = lockNeighbor.id
lockNeighbor.state = "cleared"
assert(isFloorRoomKeyLocked(lockedRoom.id), "Treasure and shop rooms should begin locked")
assert(
	enterFloorRoom(lockedRoom.id) === undefined,
	"A locked room should block entry"
)
assert(
	unlockFloorRoomWithKey(lockedRoom.id) === false,
	"A locked room should require a key"
)
assert(addFloorKeys(1) === 1, "Picking up a key should increase the floor key count")
assert(unlockFloorRoomWithKey(lockedRoom.id), "A key should unlock an adjacent room")
assert(getFloorKeyCount() === 0, "Unlocking a room should consume one key")
assert(!isFloorRoomKeyLocked(lockedRoom.id), "An unlocked room should stay unlocked")
assert(
	enterFloorRoom(lockedRoom.id)?.id === lockedRoom.id,
	"An unlocked room should be enterable"
)

const dropFloor = beginRoomFloor(68144, 2, { roomCount: 12 })
const dropRoom = dropFloor.rooms.find((room) => room.encounter)!
const dropEnemy = dropRoom.encounter!.enemies[0]
dropFloor.currentRoomId = dropRoom.id
rollFloorEnemyKeyDrop(dropEnemy.id)
assert(dropEnemy.keyDropRolled === true, "Enemy key drops should be rolled once")
assert(
	rollFloorEnemyKeyDrop(dropEnemy.id) === false,
	"An enemy should not roll a second key drop"
)
rollCurrentRoomClearKeyDrop()
assert(dropRoom.keyRewardRolled === true, "Room-clear key drops should be rolled once")
assert(
	rollCurrentRoomClearKeyDrop() === false,
	"A cleared room should not roll a second key drop"
)

clearRoomFloor()
assert(getCurrentFloorRoom() === undefined, "Clearing a floor should remove its state")
assert(discoverAllFloorRooms() === undefined, "Revealing requires an active floor")

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
