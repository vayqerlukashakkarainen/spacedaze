import { generateRoomFloor } from "../generation/rooms/roomFloorGenerator"
import type {
	RoomFloor,
	RoomFloorGenerationOptions,
	RoomFloorRoom,
	RoomFloorState,
} from "../generation/rooms/roomFloorTypes"

let activeFloor: RoomFloor | undefined

export function beginRoomFloor(
	seed: number,
	depth: number,
	options: RoomFloorGenerationOptions = {}
) {
	activeFloor = generateRoomFloor(seed, depth, options)
	return activeFloor
}

export function clearRoomFloor() {
	activeFloor = undefined
}

export function getActiveRoomFloor() {
	return activeFloor
}

export function getCurrentFloorRoom() {
	return activeFloor?.rooms.find((room) => room.id === activeFloor?.currentRoomId)
}

export function enterFloorRoom(roomId: string) {
	if (!activeFloor) return undefined
	const current = getCurrentFloorRoom()
	const destination = findRoom(roomId)
	if (!current || !destination || !current.connections.includes(roomId)) return undefined
	if (current.state === "active" && current.kind !== "combat") current.state = "cleared"
	destination.state = destination.state === "cleared" ? "cleared" : "active"
	activeFloor.currentRoomId = destination.id
	revealConnectedRooms(destination)
	return destination
}

export function markCurrentFloorRoomCleared() {
	const room = getCurrentFloorRoom()
	if (!room) return false
	room.state = "cleared"
	revealConnectedRooms(room)
	return true
}

export function markFloorEnemyDefeated(enemyPlanId: string) {
	const room = getCurrentFloorRoom()
	const enemy = room?.encounter?.enemies.find((candidate) => candidate.id === enemyPlanId)
	if (!enemy || enemy.defeated) return false
	enemy.defeated = true
	if (room.encounter!.enemies.every((candidate) => candidate.defeated)) {
		markCurrentFloorRoomCleared()
	}
	return true
}

export function setFloorRoomState(roomId: string, state: RoomFloorState) {
	const room = findRoom(roomId)
	if (!room) return false
	room.state = state
	return true
}

export function getRoomFloorSnapshot(): RoomFloor | undefined {
	if (!activeFloor) return undefined
	return {
		...activeFloor,
		rooms: activeFloor.rooms.map((room) => ({
			...room,
			coord: { ...room.coord },
			connections: [...room.connections],
			encounter: room.encounter
				? {
					...room.encounter,
					enemies: room.encounter.enemies.map((enemy) => ({ ...enemy })),
				}
				: undefined,
		})),
	}
}

function revealConnectedRooms(room: RoomFloorRoom) {
	if (!activeFloor) return
	for (const connection of room.connections) {
		const neighbor = findRoom(connection)
		if (neighbor?.state === "unseen") neighbor.state = "discovered"
	}
}

function findRoom(roomId: string) {
	return activeFloor?.rooms.find((room) => room.id === roomId)
}
