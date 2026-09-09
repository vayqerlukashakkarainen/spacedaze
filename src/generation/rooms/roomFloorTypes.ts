import type { HexCoord } from "../hexUtils"
import type { ProgressionEnemyId } from "../../services/enemyProgressionService"
import type { RewardRarity } from "../../types/rewardTypes"
import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"

export type RoomFloorKind =
	| "start"
	| "combat"
	| "reward"
	| "health"
	| "shrine"
	| "gravity"
	| "event"
	| "shop"
	| "miniBoss"
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
	keyDropRolled?: boolean
}

export interface RoomEncounterPlan {
	id: string
	tier: number
	difficultyBudget: number
	rewardTier: number
	enemies: RoomEnemyPlan[]
}

export interface RoomShopOffer {
	rewardId: string
	rarity: RewardRarity
	price: number
	purchased: boolean
}

export interface RoomShopPricing {
	depth: number
	difficulty: number
}

export type RoomEnvironmentArchetypeId =
	| "wake-hull-barricade"
	| "wake-floating-scrap"
	| "wake-fuel-cell"
	| "wake-salvage-cluster"

export type RoomEnvironmentCategory =
	| "structural"
	| "dynamic-cover"
	| "volatile"
	| "resource"

export interface RoomEnvironmentObjectPlan {
	id: string
	archetypeId: RoomEnvironmentArchetypeId
	category: RoomEnvironmentCategory
	coord: HexCoord
	orientation: number
	variant: number
	health?: number
	destroyed?: boolean
}

export interface RoomEnvironmentPlan {
	objects: RoomEnvironmentObjectPlan[]
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
	mapIdentityRevealed?: boolean
	contentCompleted: boolean
	keyRequired?: boolean
	keyUnlocked?: boolean
	keyRewardRolled?: boolean
	environment?: RoomEnvironmentPlan
	encounter?: RoomEncounterPlan
	shopOffers?: RoomShopOffer[]
	shopPricing?: RoomShopPricing
}

export interface RoomFloor {
	seed: number
	depth: number
	themeId: FloorThemeId
	startRoomId: string
	exitRoomId: string
	currentRoomId: string
	keys: number
	rooms: RoomFloorRoom[]
}

export interface RoomFloorGenerationOptions {
	roomCount?: number
	milestoneBoss?: boolean
	hubLevel?: number
}
