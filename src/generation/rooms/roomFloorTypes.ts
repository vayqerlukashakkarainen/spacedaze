import type { HexCoord } from "../hexUtils"
import type { ProgressionEnemyId } from "../../services/enemyProgressionService"

export type RoomFloorKind =
	| "start"
	| "combat"
	| "reward"
	| "health"
	| "repair"
	| "shrine"
	| "gravity"
	| "event"
	| "boss"
	| "exit"

export type RoomFloorState = "unseen" | "discovered" | "active" | "cleared"

export interface RoomEnemyPlan {
	id: string
	enemyId: ProgressionEnemyId
	wave: number
	spawnSlot: number
	elite: boolean
	defeated: boolean
}

export interface RoomEncounterPlan {
	id: string
	tier: number
	difficultyBudget: number
	rewardTier: number
	enemies: RoomEnemyPlan[]
}

export interface RoomFloorRoom {
	id: string
	coord: HexCoord
	kind: RoomFloorKind
	templateId: string
	seed: number
	distanceFromStart: number
	connections: string[]
	state: RoomFloorState
	encounter?: RoomEncounterPlan
}

export interface RoomFloor {
	seed: number
	depth: number
	startRoomId: string
	exitRoomId: string
	currentRoomId: string
	rooms: RoomFloorRoom[]
}

export interface RoomFloorGenerationOptions {
	roomCount?: number
	milestoneBoss?: boolean
	hubLevel?: number
}
