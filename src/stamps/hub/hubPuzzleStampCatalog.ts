import { HUB_CARGO_PRESS_STAMP } from "./cargoPressStamp"
import type {
	HubPuzzleStampDefinition,
	HubPuzzleStampId,
} from "./hubPuzzleStampTypes"
import { HUB_LIVE_CIRCUIT_STAMP } from "./liveCircuitStamp"

export { HUB_PUZZLE_STAMP_PLACEMENTS } from "./hubPuzzleStampPlacements"
export type {
	HubCargoObstacleStampElement,
	HubCargoPressStampDefinition,
	HubLiveCircuitStampDefinition,
	HubPuzzleStampPlacement,
	HubStampPoint,
} from "./hubPuzzleStampTypes"

export const HUB_PUZZLE_STAMP_CATALOG: Readonly<
	Record<HubPuzzleStampId, HubPuzzleStampDefinition>
> = {
	"hub-live-circuit": HUB_LIVE_CIRCUIT_STAMP,
	"hub-cargo-press": HUB_CARGO_PRESS_STAMP,
}

export function getHubPuzzleStampDefinition(id: HubPuzzleStampId) {
	return HUB_PUZZLE_STAMP_CATALOG[id]
}
