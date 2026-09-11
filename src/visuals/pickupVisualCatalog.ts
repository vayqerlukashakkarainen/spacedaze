import type { VisualRepresentation } from "./visualRepresentation"

export type PickupVisualId =
	| "health-orb"
	| "reward"
	| "room-key"
	| "phase-core"
	| "salvage-chest"
	| "salvage-chest-open"
	| "weapon-chest"
	| "weapon-chest-open"
	| "crate"
	| "golden-crate"

export const PICKUP_VISUALS: Record<PickupVisualId, VisualRepresentation> = {
	"health-orb": { parts: [], worldScale: 0.3 },
	reward: { parts: [], worldScale: 0.7 },
	"room-key": { parts: [{ sprite: "room_phase_key" }], worldScale: 0.45 },
	"phase-core": { parts: [{ sprite: "phase_core" }], worldScale: 1 },
	"salvage-chest": {
		parts: [{ sprite: "chest_salvage_world" }],
		worldScale: 0.75,
	},
	"salvage-chest-open": {
		parts: [{ sprite: "chest_salvage_open_world" }],
		worldScale: 0.75,
	},
	"weapon-chest": {
		parts: [{ sprite: "chest_weapon_world" }],
		worldScale: 0.75,
	},
	"weapon-chest-open": {
		parts: [{ sprite: "chest_weapon_open_world" }],
		worldScale: 0.75,
	},
	crate: { parts: [], worldScale: 1 },
	"golden-crate": { parts: [], worldScale: 1.2 },
}

export const SALVAGE_PICKUP_VISUALS = {
	1: {
		parts: [{ sprite: "salvage_shard" }],
		worldScale: 0.6,
		color: [90, 220, 145],
	},
	3: {
		parts: [{ sprite: "salvage_plate" }],
		worldScale: 0.7,
		color: [70, 180, 255],
	},
	5: {
		parts: [{ sprite: "salvage_core" }],
		worldScale: 0.8,
		color: [255, 225, 70],
	},
	10: {
		parts: [{ sprite: "salvage_reactor_fragment" }],
		worldScale: 0.95,
		color: [190, 75, 255],
	},
} as const

export function getPickupVisual(id: PickupVisualId) {
	return PICKUP_VISUALS[id]
}
