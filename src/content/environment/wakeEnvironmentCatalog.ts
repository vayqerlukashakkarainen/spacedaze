import type { RoomEnvironmentArchetypeId } from "../../generation/rooms/roomFloorTypes"
import type { WorldVisualId } from "../../visuals/worldVisualCatalog"

export interface WakeExplosionProfile {
	radius: number
	damage: number
	knockback: number
	detune: number
}

export interface WakeEnvironmentPropProfile {
	archetypeId: RoomEnvironmentArchetypeId
	visualId: WorldVisualId
	role: "cover" | "volatile"
	radius: number
	mass: number
	maxPushSpeed: number
	health: number
	sourceName: string
	explosion?: WakeExplosionProfile
}

const WAKE_ENVIRONMENT_PROP_CATALOG: Partial<
	Record<RoomEnvironmentArchetypeId, WakeEnvironmentPropProfile>
> = {
	"wake-hull-barricade": {
		archetypeId: "wake-hull-barricade",
		visualId: "wake-hull-barricade",
		role: "cover",
		radius: 25,
		mass: 3.8,
		maxPushSpeed: 150,
		health: 32,
		sourceName: "HULL BARRICADE",
	},
	"wake-salvage-cluster": {
		archetypeId: "wake-salvage-cluster",
		visualId: "wake-salvage-cluster",
		role: "cover",
		radius: 17,
		mass: 1.9,
		maxPushSpeed: 210,
		health: 20,
		sourceName: "SALVAGE CLUSTER",
	},
	"wake-memory-console": {
		archetypeId: "wake-memory-console",
		visualId: "wake-memory-console",
		role: "cover",
		radius: 17,
		mass: 1.9,
		maxPushSpeed: 210,
		health: 18,
		sourceName: "MEMORY CONSOLE",
	},
	"wake-cable-reel": {
		archetypeId: "wake-cable-reel",
		visualId: "wake-cable-reel",
		role: "cover",
		radius: 17,
		mass: 1.9,
		maxPushSpeed: 210,
		health: 16,
		sourceName: "CABLE REEL",
	},
	"wake-pipe-manifold": {
		archetypeId: "wake-pipe-manifold",
		visualId: "wake-pipe-manifold",
		role: "cover",
		radius: 23,
		mass: 3.3,
		maxPushSpeed: 165,
		health: 28,
		sourceName: "PIPE MANIFOLD",
	},
	"wake-sorting-gantry": {
		archetypeId: "wake-sorting-gantry",
		visualId: "wake-sorting-gantry",
		role: "cover",
		radius: 34,
		mass: 5.4,
		maxPushSpeed: 90,
		health: 48,
		sourceName: "SORTING GANTRY",
	},
	"wake-patchwork-stall": {
		archetypeId: "wake-patchwork-stall",
		visualId: "wake-patchwork-stall",
		role: "cover",
		radius: 30,
		mass: 4.6,
		maxPushSpeed: 105,
		health: 38,
		sourceName: "PATCHWORK STALL",
	},
	"wake-signal-nest": {
		archetypeId: "wake-signal-nest",
		visualId: "wake-signal-nest",
		role: "cover",
		radius: 27,
		mass: 3.9,
		maxPushSpeed: 115,
		health: 34,
		sourceName: "SIGNAL NEST",
	},
	"wake-breaker-crusher": {
		archetypeId: "wake-breaker-crusher",
		visualId: "wake-breaker-crusher",
		role: "cover",
		radius: 35,
		mass: 6.2,
		maxPushSpeed: 78,
		health: 58,
		sourceName: "BREAKER CRUSHER",
	},
	"wake-fuel-cell": {
		archetypeId: "wake-fuel-cell",
		visualId: "wake-fuel-cell",
		role: "volatile",
		radius: 12,
		mass: 1.1,
		maxPushSpeed: 145,
		health: 9,
		sourceName: "VOLATILE FUEL CELL",
		explosion: { radius: 105, damage: 14, knockback: 82, detune: -120 },
	},
	"wake-coolant-canister": {
		archetypeId: "wake-coolant-canister",
		visualId: "wake-coolant-canister",
		role: "volatile",
		radius: 12,
		mass: 1,
		maxPushSpeed: 155,
		health: 8,
		sourceName: "CRACKED COOLANT CANISTER",
		explosion: { radius: 92, damage: 12, knockback: 76, detune: 140 },
	},
	"wake-pressure-tank": {
		archetypeId: "wake-pressure-tank",
		visualId: "wake-pressure-tank",
		role: "volatile",
		radius: 22,
		mass: 2.4,
		maxPushSpeed: 125,
		health: 14,
		sourceName: "PRESSURE TANK",
		explosion: { radius: 122, damage: 17, knockback: 96, detune: -220 },
	},
	"wake-battery-bank": {
		archetypeId: "wake-battery-bank",
		visualId: "wake-battery-bank",
		role: "volatile",
		radius: 21,
		mass: 2.8,
		maxPushSpeed: 112,
		health: 17,
		sourceName: "SALVAGE BATTERY BANK",
		explosion: { radius: 135, damage: 19, knockback: 104, detune: 80 },
	},
	"wake-reactor-pod": {
		archetypeId: "wake-reactor-pod",
		visualId: "wake-reactor-pod",
		role: "volatile",
		radius: 31,
		mass: 5.2,
		maxPushSpeed: 82,
		health: 28,
		sourceName: "CRACKED REACTOR POD",
		explosion: { radius: 172, damage: 26, knockback: 138, detune: -390 },
	},
}

export function getWakeEnvironmentPropProfile(
	archetypeId: RoomEnvironmentArchetypeId
) {
	return WAKE_ENVIRONMENT_PROP_CATALOG[archetypeId]
}

export function requireWakeEnvironmentPropProfile(
	archetypeId: RoomEnvironmentArchetypeId
) {
	const profile = getWakeEnvironmentPropProfile(archetypeId)
	if (!profile) throw new Error(`Missing Wake environment profile: ${archetypeId}`)
	return profile
}
