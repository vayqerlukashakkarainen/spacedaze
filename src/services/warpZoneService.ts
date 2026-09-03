import type { FinaleId } from "../finales/finaleRegistry"

export interface WarpZoneDefinition {
	id: string
	name: string
	description: string
	poolId: string
	finaleId: FinaleId
}

export const WARP_ZONES: readonly WarpZoneDefinition[] = [
	{
		id: "zone1",
		name: "ZONE 1",
		description: "THE FIRST CHARTED EXPEDITION ZONE",
		poolId: "zone1",
		finaleId: "level2Ending",
	},
]

const WARP_ZONE_PROGRESS_KEY = "spacedaze_warp_zone_progress_v2"

interface WarpZoneProgress {
	unlockedZoneIds: string[]
}

let progress = loadProgress()

export function getUnlockedWarpZones() {
	return WARP_ZONES.filter((zone) => isWarpZoneUnlocked(zone.id))
}

export function getWarpZone(id: string) {
	return WARP_ZONES.find((zone) => zone.id === id)
}

export function isWarpZoneUnlocked(id: string) {
	return progress.unlockedZoneIds.includes(id)
}

export function unlockWarpZone(id: string) {
	if (!WARP_ZONES.some((zone) => zone.id === id)) return false
	if (isWarpZoneUnlocked(id)) return false
	progress.unlockedZoneIds.push(id)
	saveProgress()
	return true
}

function loadProgress(): WarpZoneProgress {
	const fallback: WarpZoneProgress = {
		unlockedZoneIds: ["zone1"],
	}
	const saved = localStorage.getItem(WARP_ZONE_PROGRESS_KEY)
	if (!saved) return fallback

	const parsed = JSON.parse(saved) as Partial<WarpZoneProgress>
	const unlockedZoneIds = parsed.unlockedZoneIds ?? []
	if (!unlockedZoneIds.includes("zone1")) unlockedZoneIds.unshift("zone1")
	return { unlockedZoneIds }
}

function saveProgress() {
	localStorage.setItem(WARP_ZONE_PROGRESS_KEY, JSON.stringify(progress))
}
