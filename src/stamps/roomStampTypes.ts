import type { FloorThemeId } from "../levels/floorThemes/floorThemeDirectory"
import type { HexCoord } from "../generation/hexUtils"
import type {
	RoomFloorKind,
	RoomStampId,
} from "../generation/rooms/roomFloorTypes"

export type RoomStampPurpose =
	| "combat"
	| "puzzle"
	| "traversal"
	| "hazard"
	| "reward"
	| "narrative"
	| "secret"

export interface RoomStampCell {
	coord: HexCoord
	terrain: "open" | "wall"
}

export interface RoomStampProjectileEmitter {
	type: "projectile-emitter"
	coord: HexCoord
	facing: number
	interval: number
	phase: number
}

export interface RoomStampWorldObjectAnchor {
	type: "world-object-anchor"
	objectId: "debris-deposit"
	coord: HexCoord
}

export type RoomStampMechanic =
	| RoomStampProjectileEmitter
	| RoomStampWorldObjectAnchor

export type RoomStampSpawnerMobility = "stationary" | "mobile"
export type RoomStampSpawnerDelivery = "ground" | "phase" | "portal"

export interface RoomStampEnemySpawnerSlot {
	id: string
	type: "enemy-spawner"
	coord: HexCoord
	required: boolean
	encounterPolicy: "anchor" | "supplement" | "replace"
	wave: number
	requirements: {
		maximumFootprintRadius: number
		mobility: readonly RoomStampSpawnerMobility[]
		delivery: readonly RoomStampSpawnerDelivery[]
		maximumPlacementCost: number
	}
}

export type RoomStampContentSlot = RoomStampEnemySpawnerSlot

export interface RoomStampDefinition {
	id: RoomStampId
	mode: "primary" | "overlay"
	purposes: readonly RoomStampPurpose[]
	compatibility: {
		roomKinds: readonly RoomFloorKind[]
		themes?: readonly FloorThemeId[]
		minimumSubfloor?: number
		maximumSubfloor?: number
		minimumDistanceFromStart?: number
		minimumRoomRadius?: number
		maximumRoomRadius?: number
		minimumConnections: number
		maximumConnections: number
	}
	selection: {
		weight: number
		repeatCooldown: number
		required?: boolean
		allowMirroring: boolean
		allowedRotations: readonly number[]
	}
	ports: {
		requiredDirections: readonly number[]
		exact: boolean
	}
	cells: readonly RoomStampCell[]
	mechanics: readonly RoomStampMechanic[]
	contentSlots: readonly RoomStampContentSlot[]
	validation: {
		connectAllDoors: boolean
		minimumSpawnSlots: number
		preserveDoorRoutes: boolean
	}
}
