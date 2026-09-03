export type HubFacilityId =
	| "contractTerminal"
	| "salvageForge"
	| "debriefTerminal"
	| "trainingRange"
	| "blueprintArchive"
	| "warpZones"

export interface HubFacilityDefinition {
	id: HubFacilityId
	name: string
	description: string
	cost: number
}

export const HUB_FACILITIES: readonly HubFacilityDefinition[] = [
	{
		id: "contractTerminal",
		name: "CONTRACT TERMINAL",
		description: "Choose the next sector and its payout profile",
		cost: 10,
	},
	{
		id: "salvageForge",
		name: "SALVAGE FORGE",
		description: "Improve reward recovery systems",
		cost: 15,
	},
	{
		id: "debriefTerminal",
		name: "DEBRIEF TERMINAL",
		description: "Review the result of your previous run",
		cost: 5,
	},
	{
		id: "trainingRange",
		name: "TRAINING RANGE",
		description: "Automatically deploys practice targets",
		cost: 0,
	},
	{
		id: "blueprintArchive",
		name: "BLUEPRINT ARCHIVE",
		description: "Catalogue discovered reward technology",
		cost: 10,
	},
	{
		id: "warpZones",
		name: "WARP ZONES",
		description: "Review unlocked destinations",
		cost: 15,
	},
]

const HUB_PROGRESS_KEY = "spacedaze_hub_progress_v2"

interface HubProgress {
	builtFacilities: HubFacilityId[]
	forgeLevel: number
	discoveredBlueprints: string[]
}

let progress = loadProgress()

export function isFacilityBuilt(id: HubFacilityId) {
	return progress.builtFacilities.includes(id)
}

export function buildFacility(id: HubFacilityId) {
	if (isFacilityBuilt(id)) return
	progress.builtFacilities.push(id)
	saveProgress()
}

export function getForgeLevel() {
	return progress.forgeLevel
}

export function upgradeForge() {
	if (progress.forgeLevel >= 3) return false
	progress.forgeLevel++
	saveProgress()
	return true
}

export function getForgeUpgradeCost() {
	return 20 * (progress.forgeLevel + 1)
}

export function getForgeDropMultiplier() {
	return 1 + progress.forgeLevel * 0.15
}

export function discoverBlueprint(key: string) {
	if (progress.discoveredBlueprints.includes(key)) return
	progress.discoveredBlueprints.push(key)
	saveProgress()
}

export function isBlueprintDiscovered(key: string) {
	return progress.discoveredBlueprints.includes(key)
}

export function getDiscoveredBlueprintCount() {
	return progress.discoveredBlueprints.length
}

function loadProgress(): HubProgress {
	const fallback: HubProgress = {
		builtFacilities: ["trainingRange"],
		forgeLevel: 0,
		discoveredBlueprints: [],
	}
	const saved = localStorage.getItem(HUB_PROGRESS_KEY)
	if (!saved) return fallback

	const parsed = JSON.parse(saved) as Partial<HubProgress>
	return {
		builtFacilities: parsed.builtFacilities ?? [],
		forgeLevel: parsed.forgeLevel ?? 0,
		discoveredBlueprints: parsed.discoveredBlueprints ?? [],
	}
}

function saveProgress() {
	localStorage.setItem(HUB_PROGRESS_KEY, JSON.stringify(progress))
}
