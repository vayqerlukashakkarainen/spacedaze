import type { DroneType } from "../services/player/droneRoleService"
import type { VisualRepresentation } from "./visualRepresentation"

export type CompanionVisualId = DroneType |
	"hacked-ally" |
	"active-module-carrier" |
	"burt"

export const COMPANION_VISUALS: Record<CompanionVisualId, VisualRepresentation> = {
	combat: { parts: [{ sprite: "drone_combat" }], worldScale: 1 },
	missile: { parts: [{ sprite: "drone_missile" }], worldScale: 1 },
	interceptor: { parts: [{ sprite: "drone_interceptor" }], worldScale: 1 },
	gunship: { parts: [{ sprite: "drone_gunship" }], worldScale: 1 },
	medic: { parts: [{ sprite: "drone_medic" }], worldScale: 1 },
	salvager: { parts: [{ sprite: "drone_salvager" }], worldScale: 1 },
	"hacked-ally": { parts: [{ sprite: "enemy_fighter_core" }], worldScale: 1 },
	"active-module-carrier": {
		parts: [{ sprite: "rocket1" }],
		worldScale: 1,
	},
	burt: { parts: [{ sprite: "companion_burt" }], worldScale: 1 },
}

export function getCompanionVisual(id: CompanionVisualId) {
	return COMPANION_VISUALS[id]
}
