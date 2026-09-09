import type { VisualRepresentation } from "./visualRepresentation"

export type WorldVisualId =
	| "capture-shrine"
	| "damage-shrine"
	| "health-shrine"
	| "gravity-shrine"
	| "gravity-anomaly-shrine"
	| "debris-foundation"
	| "debris-house"
	| "minefield"
	| "lost-convoy"
	| "volatile-cargo"
	| "wake-hull-barricade"
	| "wake-fuel-cell"

export const WORLD_VISUALS: Record<WorldVisualId, VisualRepresentation> = {
	"capture-shrine": { parts: [{ sprite: "shrine_capture" }], worldScale: 1.5 },
	"damage-shrine": { parts: [{ sprite: "shrine_damage" }], worldScale: 1.5 },
	"health-shrine": { parts: [{ sprite: "shrine_health" }], worldScale: 1.5 },
	"gravity-shrine": { parts: [{ sprite: "shrine_gravity" }], worldScale: 1.25 },
	"gravity-anomaly-shrine": {
		parts: [{ sprite: "shrine_gravity" }],
		worldScale: 1.5,
	},
	"debris-foundation": {
		parts: [{ sprite: "hub_ground_scrap_sorter_rocks" }],
		worldScale: 0.56,
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

export function getWorldVisual(id: WorldVisualId) {
	return WORLD_VISUALS[id]
}
