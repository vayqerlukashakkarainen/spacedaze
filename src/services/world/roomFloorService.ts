import {
	extendEndlessRoomFloor,
	generateRoomFloor,
} from "../../generation/rooms/roomFloorGenerator"
import type {
	RoomFloor,
	RoomFloorGenerationOptions,
	RoomFloorRoom,
	RoomFloorState,
} from "../../generation/rooms/roomFloorTypes"
import { getPilotProtocolValue } from "../hub/pilotProtocolService"

let activeFloor: RoomFloor | undefined

export const ROOM_ENEMY_KEY_DROP_CHANCE = 0.01
export const ROOM_CLEAR_KEY_DROP_CHANCE = 0.1

export function beginRoomFloor(
	seed: number,
	depth: number,
	options: RoomFloorGenerationOptions = {}
) {
	activeFloor = generateRoomFloor(seed, depth, options)
	const start = getCurrentFloorRoom()
	if (start) revealConnectedRooms(start)
	if (getPilotProtocolValue("signalDecoder") >= 3) {
		const special = activeFloor.rooms
			.filter((room) =>
				!["start", "chill", "combat", "exit"].includes(room.kind)
			)
			.sort((a, b) => Math.abs(a.seed) - Math.abs(b.seed))[0]
		if (special) {
			special.state = special.state === "unseen" ? "discovered" : special.state
			special.intelLevel = 3
			special.mapIdentityRevealed = true
		}
	}
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

export function getRemainingFloorDepositCount() {
	return activeFloor?.rooms.filter(
		(room) => room.kind === "deposit" && !room.contentCompleted
	).length ?? 0
}

export function getFloorCargoPuzzleForRoom(roomId: string) {
	return activeFloor?.cargoPuzzles.find((puzzle) =>
		puzzle.sourceRoomId === roomId || puzzle.targetRoomId === roomId
	)
}

export function activateFloorCargoPuzzle(puzzleId: string) {
	if (!activeFloor) return false
	const puzzle = activeFloor.cargoPuzzles.find((candidate) =>
		candidate.id === puzzleId
	)
	if (!puzzle || puzzle.socketActivated) return false
	puzzle.socketActivated = true
	const sourceRoom = activeFloor.rooms.find((room) =>
		room.id === puzzle.sourceRoomId
	)
	if (sourceRoom) sourceRoom.contentCompleted = true
	return true
}

export function extendCurrentEndlessRoomFloor() {
	const room = getCurrentFloorRoom()
	if (!activeFloor || !room) return []
	return extendEndlessRoomFloor(activeFloor, room.id)
}

export function enterFloorRoom(roomId: string) {
	if (!activeFloor) return undefined
	const current = getCurrentFloorRoom()
	const destination = findRoom(roomId)
	if (!current || !destination || !current.connections.includes(roomId)) return undefined
	if (isFloorRoomConnectionSealed(current.id, destination.id)) return undefined
	if (current.state !== "cleared") return undefined
	if (roomRequiresKey(destination) && destination.keyUnlocked !== true) return undefined
	claimRouteResonance(current, destination)
	destination.state = destination.state === "cleared" ? "cleared" : "active"
	destination.intelLevel = 3
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
	if (isFloorRoomConnectionSealed(current.id, destination.id)) return undefined
	if (current.state !== "cleared" && !allowUnclearedOrigin) return undefined
	destination.state = destination.state === "cleared" ? "cleared" : "active"
	destination.intelLevel = 3
	activeFloor.currentRoomId = destination.id
	revealConnectedRooms(destination)
	return destination
}

export function markCurrentFloorRoomCleared() {
	const room = getCurrentFloorRoom()
	if (!room) return false
	room.state = "cleared"
	room.intelLevel = 3
	revealConnectedRooms(room)
	prepareRouteResonance(room)
	return true
}

export function markFloorEnemyDefeated(enemyPlanId: string) {
	const room = getCurrentFloorRoom()
	const enemy = room?.encounter?.enemies.find((candidate) => candidate.id === enemyPlanId)
	if (!enemy || enemy.defeated) return false
	enemy.defeated = true
	return true
}

export function getFloorKeyCount() {
	return activeFloor?.keys ?? 0
}

export function addFloorKeys(amount = 1) {
	if (!activeFloor) return 0
	const added = Math.max(0, Math.floor(amount))
	activeFloor.keys += added
	return activeFloor.keys
}

export function isFloorRoomKeyLocked(roomId: string) {
	const room = findRoom(roomId)
	return room !== undefined &&
		roomRequiresKey(room) &&
		room.keyUnlocked !== true
}

export function sealFloorStartRoomExit() {
	if (!activeFloor || activeFloor.sealedStartRoomExit === true) return false
	activeFloor.sealedStartRoomExit = true
	return true
}

export function isFloorRoomConnectionSealed(
	originRoomId: string,
	destinationRoomId: string
) {
	return activeFloor?.sealedStartRoomExit === true &&
		(
			originRoomId === activeFloor.startRoomId ||
			destinationRoomId === activeFloor.startRoomId
		)
}

export function unlockFloorRoomWithKey(roomId: string) {
	if (!activeFloor || activeFloor.keys <= 0) return false
	const current = getCurrentFloorRoom()
	const room = findRoom(roomId)
	if (
		!current ||
		current.state !== "cleared" ||
		!current.connections.includes(roomId) ||
		!room ||
		!roomRequiresKey(room) ||
		room.keyUnlocked === true
	) return false
	activeFloor.keys--
	room.keyUnlocked = true
	return true
}

export function rollFloorEnemyKeyDrop(enemyPlanId: string) {
	const room = getCurrentFloorRoom()
	const enemy = room?.encounter?.enemies.find(
		(candidate) => candidate.id === enemyPlanId
	)
	if (!room || !enemy || enemy.keyDropRolled === true) return false
	enemy.keyDropRolled = true
	return deterministicChance(
		room.seed,
		`enemy-key:${enemy.id}`,
		ROOM_ENEMY_KEY_DROP_CHANCE
	)
}

export function rollCurrentRoomClearKeyDrop() {
	const room = getCurrentFloorRoom()
	if (
		!room ||
		room.keyRewardRolled === true ||
		![
			"combat",
			"reward",
			"shrine",
			"gravity",
			"event",
			"miniBoss",
			"boss",
		].includes(room.kind)
	) return false
	room.keyRewardRolled = true
	return deterministicChance(
		room.seed,
		"room-clear-key",
		ROOM_CLEAR_KEY_DROP_CHANCE
	)
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
		if (
			room.state === "discovered" &&
			(room.intelLevel !== 3 || room.mapIdentityRevealed !== true)
		) {
			room.intelLevel = 3
			room.mapIdentityRevealed = true
			changed = true
		}
		if (changed) discoveredCount++
	}
	return discoveredCount
}

export function deepScanFloorRoom(roomId: string) {
	const room = findRoom(roomId)
	if (!room || room.state === "unseen" || (room.intelLevel ?? 0) >= 3) return false
	room.intelLevel = 3
	room.mapIdentityRevealed = true
	return true
}

export function getRoomFloorSnapshot(): RoomFloor | undefined {
	if (!activeFloor) return undefined
	return {
		...activeFloor,
		cargoPuzzles: activeFloor.cargoPuzzles.map((puzzle) => ({ ...puzzle })),
		rooms: activeFloor.rooms.map((room) => ({
			...room,
			coord: { ...room.coord },
			connections: [...room.connections],
				environment: room.environment
				? {
					objects: room.environment.objects.map((object) => ({
						...object,
						coord: { ...object.coord },
					})),
					groundPlatforms: room.environment.groundPlatforms?.map((platform) => ({
						...platform,
						cells: platform.cells.map((cell) => ({ ...cell })),
					})),
					scrapFields: room.environment.scrapFields?.map((field) => ({
						...field,
						center: { ...field.center },
						scrap: field.scrap.map((piece) => ({
							...piece,
							coord: { ...piece.coord },
						})),
					})),
				}
				: undefined,
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
		if (!neighbor) continue
		if (neighbor.state === "unseen") neighbor.state = "discovered"
		const adjacentIntel = getPilotProtocolValue("threatAnalyzer") > 0 ? 2 : 1
		neighbor.intelLevel = Math.max(neighbor.intelLevel ?? 0, adjacentIntel) as 0 | 1 | 2 | 3
	}
	const decoderRange = getPilotProtocolValue("signalDecoder")
	if (decoderRange <= 0) return
	let frontier = [...room.connections]
	const visited = new Set([room.id, ...frontier])
	for (let step = 0; step < decoderRange; step++) {
		const next: string[] = []
		for (const roomId of frontier) {
			const source = findRoom(roomId)
			for (const connectionId of source?.connections ?? []) {
				if (visited.has(connectionId)) continue
				visited.add(connectionId)
				const neighbor = findRoom(connectionId)
				if (!neighbor) continue
				if (neighbor.state === "unseen") neighbor.state = "discovered"
				neighbor.intelLevel = Math.max(neighbor.intelLevel ?? 0, 1) as 0 | 1 | 2 | 3
				next.push(connectionId)
			}
		}
		frontier = next
	}
}

function prepareRouteResonance(room: RoomFloorRoom) {
	if (!activeFloor) return
	const candidates = room.connections
		.map(findRoom)
		.filter((candidate): candidate is RoomFloorRoom =>
			candidate !== undefined && candidate.state !== "cleared"
		)
	if (candidates.length < 2) return
	const bonuses = ["rewardCache", "salvageSurge", "keyEcho", "deepScan"] as const
	for (let index = 0; index < candidates.length; index++) {
		const candidate = candidates[index]
		if (candidate.resonanceState === "claimed") continue
		candidate.resonanceState = "available"
		candidate.resonanceBonus = bonuses[Math.abs(candidate.seed + index) % bonuses.length]
	}
}

function claimRouteResonance(origin: RoomFloorRoom, destination: RoomFloorRoom) {
	if (destination.resonanceState !== "available") return
	destination.resonanceState = "claimed"
	for (const roomId of origin.connections) {
		const sibling = findRoom(roomId)
		if (sibling && sibling.id !== destination.id && sibling.resonanceState === "available") {
			sibling.resonanceState = "expired"
		}
	}
	if (destination.resonanceBonus === "deepScan" && activeFloor) {
		const target = activeFloor.rooms
			.filter((room) => (room.intelLevel ?? 0) < 3)
			.sort((a, b) => b.distanceFromStart - a.distanceFromStart)[0]
		if (target) target.intelLevel = 3
	}
}

function findRoom(roomId: string) {
	return activeFloor?.rooms.find((room) => room.id === roomId)
}

function roomRequiresKey(room: RoomFloorRoom) {
	return room.keyRequired === true ||
		room.kind === "reward" ||
		room.kind === "shop" ||
		room.kind === "droneShop"
}

function deterministicChance(seed: number, salt: string, chance: number) {
	let hash = seed | 0
	for (let index = 0; index < salt.length; index++) {
		hash ^= salt.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0) / 0x100000000 < chance
}
