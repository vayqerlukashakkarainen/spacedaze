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
	if (current.state !== "cleared") return undefined
	destination.state = destination.state === "cleared" ? "cleared" : "active"
	activeFloor.currentRoomId = destination.id
	revealConnectedRooms(destination)
	return destination
}

export function teleportToFloorRoom(
	roomId: string,
	allowUnclearedOrigin = false
) {
	if (!activeFloor) return undefined
	const current = getCurrentFloorRoom()
	const destination = findRoom(roomId)
	if (!current || !destination || current.id === destination.id) return undefined
	if (current.state !== "cleared" && !allowUnclearedOrigin) return undefined
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
	return true
}

export function setFloorRoomState(roomId: string, state: RoomFloorState) {
	const room = findRoom(roomId)
	if (!room) return false
	room.state = state
	return true
}

export function markCurrentRoomContentCompleted() {
	const room = getCurrentFloorRoom()
	if (!room || room.contentCompleted) return false
	room.contentCompleted = true
	return true
}

export function discoverAllFloorRooms(): number | undefined {
	if (!activeFloor) return undefined
	let discoveredCount = 0
	for (const room of activeFloor.rooms) {
		let changed = false
		if (room.state === "unseen") {
			room.state = "discovered"
			changed = true
		}
		if (room.state === "discovered" && room.mapIdentityRevealed !== true) {
			room.mapIdentityRevealed = true
			changed = true
		}
		if (changed) discoveredCount++
	}
	return discoveredCount
}

export function getRoomFloorSnapshot(): RoomFloor | undefined {
	if (!activeFloor) return undefined
	return {
		...activeFloor,
		rooms: activeFloor.rooms.map((room) => ({
			...room,
			coord: { ...room.coord },
			connections: [...room.connections],
			shopOffers: room.shopOffers?.map((offer) => ({ ...offer })),
			shopPricing: room.shopPricing ? { ...room.shopPricing } : undefined,
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
