import type { HubFacilityId } from "./hubProgressService"

export const HUB_HALF_WIDTH = 1400
export const HUB_HALF_HEIGHT = 1140

export const HUB_FACILITY_OFFSETS: Readonly<
	Record<HubFacilityId, readonly [number, number]>
> = {
	contractTerminal: [300, -430],
	trainingRange: [720, 390],
	salvageForge: [-500, -390],
	debriefTerminal: [-760, 170],
}

export const HUB_WORMHOLE_OFFSET = [820, -400] as const
export const HUB_PHASE_FIELD_OFFSET = [1020, 100] as const
export const HUB_FIRING_RANGE_OFFSET = [720, 760] as const
