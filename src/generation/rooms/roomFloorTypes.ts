import type { HexCoord } from "../hexUtils"
import type { ProgressionEnemyId } from "../../services/enemies/enemyProgressionService"
import type { RewardRarity } from "../../types/rewardTypes"
import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"

export type RoomFloorKind =
	| "start"
	| "chill"
	| "combat"
	| "reward"
	| "health"
	| "shrine"
	| "gravity"
	| "event"
	| "shop"
	| "droneShop"
	| "lassoComponent"
	| "lassoTrial"
	| "scrapCircuit"
	| "thrusterPuzzle"
	| "cargoPuzzleSource"
	| "cargoPuzzleTarget"
	| "deposit"
	| "miniBoss"
	| "boss"
	| "exit"

export type RoomFloorState = "unseen" | "discovered" | "active" | "cleared"

export type RoomIntelLevel = 0 | 1 | 2 | 3
export type RoomDangerReward = "doubleChest" | "salvageBurst"
export type RoomResonanceBonus = "rewardCache" | "salvageSurge" | "keyEcho" | "deepScan"
export type RoomResonanceState = "available" | "claimed" | "expired"

export type RoomEnemyArrivalMode = "resident" | "phaseJump"

export interface RoomEnemyPlan {
	id: string
	enemyId: ProgressionEnemyId
	wave: number
	spawnSlot: number
	elite: boolean
	defeated: boolean
	keyDropRolled?: boolean
	arrivalMode?: RoomEnemyArrivalMode
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
	| "wake-concussion-plate"
	| "wake-slowdown-plate"
	| "wake-tesla-coil"
	| "wake-salvage-cluster"
	| "wake-memory-console"
	| "wake-cable-reel"
	| "wake-pipe-manifold"
	| "wake-pressure-tank"
	| "wake-battery-bank"
	| "wake-sorting-gantry"
	| "wake-coolant-canister"
	| "wake-patchwork-stall"
	| "wake-signal-nest"
	| "wake-reactor-pod"
	| "wake-breaker-crusher"

export type RoomEnvironmentCategory =
	| "structural"
	| "destructible-cover"
	| "dynamic-cover"
	| "volatile"
	| "trap"
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
	groundPlatforms?: RoomGroundPlatformPlan[]
	scrapFields?: RoomScrapFieldPlan[]
}

export interface RoomGroundPlatformPlan {
	id: string
	style: "wake-rock"
	cells: HexCoord[]
}

export interface RoomScrapFieldPiecePlan {
	id: string
	coord: HexCoord
	orientation: number
	variant: number
	destroyed?: boolean
}

export interface RoomScrapFieldPlan {
	id: string
	center: HexCoord
	seed: number
	rewardTier: number
	rewardId?: string
	rewardRarity?: RewardRarity
	rewardRevealed?: boolean
	rewardCollected?: boolean
	scrap: RoomScrapFieldPiecePlan[]
}

export interface RoomCargoPuzzlePlan {
	id: string
	sourceRoomId: string
	targetRoomId: string
	socketActivated: boolean
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
	intelLevel?: RoomIntelLevel
	dangerLevel?: 1 | 2 | 3
	dangerReward?: RoomDangerReward
	resonanceBonus?: RoomResonanceBonus
	resonanceState?: RoomResonanceState
	contentCompleted: boolean
	rewardClaims?: number
	keyRequired?: boolean
	keyUnlocked?: boolean
	keyRewardRolled?: boolean
	environment?: RoomEnvironmentPlan
	encounter?: RoomEncounterPlan
	shopOffers?: RoomShopOffer[]
	shopPricing?: RoomShopPricing
	bossId?: "federation-dreadnought" | "wake-yardmaster" | "wake-last-beacon"
}

export interface RoomFloor {
	seed: number
	depth: number
	themeId: FloorThemeId
	endless?: boolean
	maxRoomCount?: number
	hubLevel?: number
	startRoomId: string
	exitRoomId: string
	currentRoomId: string
	keys: number
	sealedStartRoomExit?: boolean
	shopDiscountUsed?: boolean
	rooms: RoomFloorRoom[]
	cargoPuzzles: RoomCargoPuzzlePlan[]
}

export interface RoomFloorGenerationOptions {
	roomCount?: number
	maxRoomCount?: number
	milestoneBoss?: boolean
	hubLevel?: number
	endless?: boolean
	lassoComponentAvailable?: boolean
	lassoTrialAvailable?: boolean
	scrapCircuitAvailable?: boolean
	thrusterPuzzleAvailable?: boolean
	cargoPuzzleAvailable?: boolean
}
