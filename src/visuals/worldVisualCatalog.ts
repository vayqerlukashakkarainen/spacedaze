import type { VisualRepresentation } from "./visualRepresentation"

export type WorldVisualId =
	| "capture-shrine"
	| "damage-shrine"
	| "health-shrine"
	| "gravity-shrine"
	| "gravity-anomaly-shrine"
	| "debris-house"
	| "minefield"
	| "lost-convoy"
	| "volatile-cargo"
	| "wake-hull-barricade"
	| "wake-fuel-cell"
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

export const WORLD_VISUALS: Record<WorldVisualId, VisualRepresentation> = {
	"capture-shrine": { parts: [{ sprite: "shrine_capture" }], worldScale: 1.5 },
	"damage-shrine": { parts: [{ sprite: "shrine_damage" }], worldScale: 1.5 },
	"health-shrine": { parts: [{ sprite: "shrine_health" }], worldScale: 1.5 },
	"gravity-shrine": { parts: [{ sprite: "shrine_gravity" }], worldScale: 1.25 },
	"gravity-anomaly-shrine": {
		parts: [{ sprite: "shrine_gravity" }],
		worldScale: 1.5,
	},
	"debris-house": {
		parts: [{ sprite: "hub_building_service_kiosk" }],
		worldScale: 0.95,
	},
	minefield: { parts: [{ sprite: "room_proximity_mine" }], worldScale: 0.82 },
	"lost-convoy": { parts: [{ sprite: "room_convoy_drone" }], worldScale: 1 },
	"volatile-cargo": { parts: [{ sprite: "crate1" }], worldScale: 0.58 },
	"wake-hull-barricade": {
		parts: [{ sprite: "wake_hull_barricade" }],
		worldScale: 1,
	},
	"wake-fuel-cell": {
		parts: [{ sprite: "wake_fuel_cell" }],
		worldScale: 1,
	},
	"wake-salvage-cluster": {
		parts: [{ sprite: "wake_salvage_cluster" }],
		worldScale: 1,
	},
	"wake-memory-console": {
		parts: [{ sprite: "wake_memory_console" }],
		worldScale: 1,
	},
	"wake-cable-reel": {
		parts: [{ sprite: "wake_cable_reel" }],
		worldScale: 1,
	},
	"wake-pipe-manifold": {
		parts: [{ sprite: "wake_pipe_manifold" }],
		worldScale: 1,
	},
	"wake-pressure-tank": {
		parts: [{ sprite: "wake_pressure_tank" }],
		worldScale: 1,
	},
	"wake-battery-bank": {
		parts: [{ sprite: "wake_battery_bank" }],
		worldScale: 1,
	},
	"wake-sorting-gantry": {
		parts: [{ sprite: "wake_sorting_gantry" }],
		worldScale: 1,
	},
	"wake-coolant-canister": {
		parts: [{ sprite: "wake_coolant_canister" }],
		worldScale: 1,
	},
	"wake-patchwork-stall": {
		parts: [{ sprite: "wake_patchwork_stall" }],
		worldScale: 1,
	},
	"wake-signal-nest": {
		parts: [{ sprite: "wake_signal_nest" }],
		worldScale: 1,
	},
	"wake-reactor-pod": {
		parts: [{ sprite: "wake_reactor_pod" }],
		worldScale: 1,
	},
	"wake-breaker-crusher": {
		parts: [{ sprite: "wake_breaker_crusher" }],
		worldScale: 1,
	},
}

export interface RunVillageVisual extends VisualRepresentation {
	destroyedSprite?: string
	buildingOffsetY: number
}

export const RUN_VILLAGE_VISUALS: readonly RunVillageVisual[] = [
	{ parts: [{ sprite: "hub_building_service_kiosk" }], buildingOffsetY: -14, worldScale: 0.8 },
	{ parts: [{ sprite: "hub_building_courier_depot" }], buildingOffsetY: -16, worldScale: 0.72 },
	{ parts: [{ sprite: "hub_building_scrap_sorter" }], buildingOffsetY: -22, worldScale: 0.62 },
	{ parts: [{ sprite: "hub_building_smelter_annex" }], destroyedSprite: "hub_building_smelter_annex_destroyed", buildingOffsetY: -30, worldScale: 0.56 },
	{ parts: [{ sprite: "hub_building_listening_post" }], destroyedSprite: "hub_building_listening_post_destroyed", buildingOffsetY: -36, worldScale: 0.58 },
	{ parts: [{ sprite: "hub_building_repair_drydock" }], destroyedSprite: "hub_building_repair_drydock_destroyed", buildingOffsetY: -16, worldScale: 0.48 },
	{ parts: [{ sprite: "hub_building_fuel_farm" }], destroyedSprite: "hub_building_fuel_farm_destroyed", buildingOffsetY: -22, worldScale: 0.48 },
	{ parts: [{ sprite: "hub_building_freight_terminal" }], destroyedSprite: "hub_building_freight_terminal_destroyed", buildingOffsetY: -20, worldScale: 0.42 },
]

export const HUB_RACE_LAMP_VISUALS: readonly VisualRepresentation[] = [
	{ parts: [{ sprite: "hub_race_lamp_1" }], worldScale: 1 },
	{ parts: [{ sprite: "hub_race_lamp_2" }], worldScale: 1 },
	{ parts: [{ sprite: "hub_race_lamp_3" }], worldScale: 1 },
]

export const HUB_RACE_LAMP_PLATFORM_VISUALS: readonly VisualRepresentation[] = [
	{ parts: [{ sprite: "hub_progression_lamp_platform_01" }], worldScale: 0.72 },
	{ parts: [{ sprite: "hub_progression_lamp_platform_02" }], worldScale: 0.72 },
	{ parts: [{ sprite: "hub_progression_lamp_platform_03" }], worldScale: 0.72 },
	{ parts: [{ sprite: "hub_progression_lamp_platform_04" }], worldScale: 0.72 },
	{ parts: [{ sprite: "hub_progression_lamp_platform_05" }], worldScale: 0.72 },
	{ parts: [{ sprite: "hub_progression_lamp_platform_06" }], worldScale: 0.72 },
]

export function getWorldVisual(id: WorldVisualId) {
	return WORLD_VISUALS[id]
}
