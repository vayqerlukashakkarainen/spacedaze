export type HubFacilityId =
	| "contractTerminal"
	| "salvageForge"
	| "debriefTerminal"
	| "trainingRange"

export type HubGhostChestType = "salvage" | "weapon"

export interface HubFacilityDefinition {
	id: HubFacilityId
	name: string
	description: string
	cost: number
	requiredHubLevel: number
}

export interface HubLevelDefinition {
	level: number
	requiredDeposited: number
	chestLuck: number
	unlocks: readonly string[]
}

export interface HubDepositResult {
	deposited: number
	previousLevel: number
	currentLevel: number
	previousXp: number
	currentXp: number
	unlocks: string[]
}

export const HUB_LEVELS: readonly HubLevelDefinition[] = [
	{ level: 1, requiredDeposited: 0, chestLuck: 0, unlocks: ["PHASE STATION", "SALVAGE GHOST CHEST"] },
	{ level: 2, requiredDeposited: 75, chestLuck: 0.03, unlocks: ["CONTRACT TERMINAL", "SECOND SALVAGE GHOST CHEST"] },
	{ level: 3, requiredDeposited: 200, chestLuck: 0.06, unlocks: ["SALVAGE FORGE", "GHOST WEAPON CACHE"] },
	{ level: 4, requiredDeposited: 400, chestLuck: 0.09, unlocks: ["POST-RUN DEBRIEF TERMINAL"] },
	{ level: 5, requiredDeposited: 700, chestLuck: 0.12, unlocks: ["TRAINING RANGE EXPANSION", "THIRD SALVAGE GHOST CHEST"] },
	{ level: 6, requiredDeposited: 1100, chestLuck: 0.15, unlocks: [] },
	{ level: 7, requiredDeposited: 1600, chestLuck: 0.18, unlocks: [] },
	{ level: 8, requiredDeposited: 2250, chestLuck: 0.2, unlocks: ["HUB RESTORATION COMPLETE"] },
]

export const HUB_FACILITIES: readonly HubFacilityDefinition[] = [
	{ id: "trainingRange", name: "PHASE STATION", description: "Central registry for ship systems, weapons, and upgrades", cost: 0, requiredHubLevel: 1 },
	{ id: "contractTerminal", name: "CONTRACT TERMINAL", description: "Select and prepare the next expedition", cost: 40, requiredHubLevel: 2 },
	{ id: "salvageForge", name: "SALVAGE FORGE", description: "Improve reward recovery from destroyed hostiles", cost: 75, requiredHubLevel: 3 },
	{ id: "debriefTerminal", name: "DEBRIEF TERMINAL", description: "Review the most recent expedition record", cost: 100, requiredHubLevel: 4 },
]

const HUB_PROGRESS_KEY = "spacedaze_hub_progress_v2"

interface HubProgress {
	builtFacilities: HubFacilityId[]
	forgeLevel: number
	discoveredBlueprints: string[]
	unseenBlueprints: string[]
	lifetimeDeposited: number
	salvageGhostChestStock: number
	weaponGhostChestStock: number
}

let progress = loadProgress()

export function resetHubProgress() {
	progress = createDefaultProgress()
	removeSavedProgress()
}

export function getHubLevel() {
	return getHubLevelForDeposited(progress.lifetimeDeposited)
}

export function getHubLevelForDeposited(xp: number) {
	let level = 1
	for (const definition of HUB_LEVELS) {
		if (definition.requiredDeposited > xp) break
		level = definition.level
	}
	return level
}

export function getHubLifetimeDeposited() {
	return progress.lifetimeDeposited
}

export function getHubChestLuck() {
	return getHubLevelDefinition(getHubLevel()).chestLuck
}

export function getHubLevelDefinition(level: number) {
	return HUB_LEVELS.find((definition) => definition.level === level) ?? HUB_LEVELS[0]
}

export function getHubLevelProgress() {
	const level = getHubLevel()
	const current = getHubLevelDefinition(level)
	const next = HUB_LEVELS.find((definition) => definition.level === level + 1)
	if (!next) {
		return { level, current: progress.lifetimeDeposited, required: progress.lifetimeDeposited, progress: 1 }
	}
	const earned = progress.lifetimeDeposited - current.requiredDeposited
	const span = next.requiredDeposited - current.requiredDeposited
	return {
		level,
		current: progress.lifetimeDeposited,
		required: next.requiredDeposited,
		progress: Math.min(1, Math.max(0, earned / span)),
	}
}

export function recordHubDeposit(amount: number): HubDepositResult {
	const deposited = normalizeAmount(amount)
	const previousXp = progress.lifetimeDeposited
	const previousLevel = getHubLevelForDeposited(previousXp)
	progress.lifetimeDeposited += deposited
	const currentLevel = getHubLevel()
	const unlocks = HUB_LEVELS
		.filter((definition) => definition.level > previousLevel && definition.level <= currentLevel)
		.flatMap((definition) => definition.unlocks)
	restockHubGhostChests(false)
	saveProgress()
	return { deposited, previousLevel, currentLevel, previousXp, currentXp: progress.lifetimeDeposited, unlocks }
}

export function setHubLevelForDebug(level: number) {
	const clamped = Math.min(HUB_LEVELS.length, Math.max(1, Math.round(level)))
	progress.lifetimeDeposited = getHubLevelDefinition(clamped).requiredDeposited
	restockHubGhostChests(false)
	saveProgress()
}

export function isFacilityUnlocked(id: HubFacilityId) {
	const facility = HUB_FACILITIES.find((definition) => definition.id === id)
	return facility !== undefined && (isFacilityBuilt(id) || getHubLevel() >= facility.requiredHubLevel)
}

export function isFacilityBuilt(id: HubFacilityId) {
	return progress.builtFacilities.includes(id)
}

export function buildFacility(id: HubFacilityId) {
	if (!isFacilityUnlocked(id) || isFacilityBuilt(id)) return false
	progress.builtFacilities.push(id)
	saveProgress()
	return true
}

export function getHubGhostChestCapacity(type: HubGhostChestType) {
	const level = getHubLevel()
	if (type === "weapon") return level >= 3 ? 1 : 0
	return level >= 5 ? 3 : level >= 2 ? 2 : 1
}

export function getHubGhostChestStock(type: HubGhostChestType) {
	return type === "weapon" ? progress.weaponGhostChestStock : progress.salvageGhostChestStock
}

export function consumeHubGhostChest(type: HubGhostChestType) {
	if (getHubGhostChestStock(type) <= 0) return false
	if (type === "weapon") progress.weaponGhostChestStock--
	else progress.salvageGhostChestStock--
	saveProgress()
	return true
}

export function restockHubGhostChests(save = true) {
	progress.salvageGhostChestStock = getHubGhostChestCapacity("salvage")
	progress.weaponGhostChestStock = getHubGhostChestCapacity("weapon")
	if (save) saveProgress()
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
	if (progress.discoveredBlueprints.includes(key)) return false
	progress.discoveredBlueprints.push(key)
	progress.unseenBlueprints.push(key)
	saveProgress()
	return true
}

export function isBlueprintDiscovered(key: string) {
	return progress.discoveredBlueprints.includes(key)
}

export function getDiscoveredBlueprintCount() {
	return progress.discoveredBlueprints.length
}

export function getUnseenBlueprintKeys() {
	return [...progress.unseenBlueprints]
}

export function hasUnseenBlueprints() {
	return progress.unseenBlueprints.length > 0
}

export function markBlueprintsSeen(keys: readonly string[]) {
	if (keys.length === 0) return
	const seen = new Set(keys)
	const unseenBlueprints = progress.unseenBlueprints.filter(
		(key) => !seen.has(key)
	)
	if (unseenBlueprints.length === progress.unseenBlueprints.length) return
	progress.unseenBlueprints = unseenBlueprints
	saveProgress()
}

function loadProgress(): HubProgress {
	const fallback = createDefaultProgress()
	const saved = readSavedProgress()
	if (!saved) return fallback
	const parsed = JSON.parse(saved) as Partial<HubProgress> & { builtFacilities?: string[] }
	const builtFacilities = (parsed.builtFacilities ?? []).filter(
		(id): id is HubFacilityId => HUB_FACILITIES.some((facility) => facility.id === id)
	)
	if (!builtFacilities.includes("trainingRange")) builtFacilities.push("trainingRange")
	const lifetimeDeposited = normalizeAmount(parsed.lifetimeDeposited ?? 0)
	const level = getHubLevelForDeposited(lifetimeDeposited)
	const salvageCapacity = level >= 5 ? 3 : level >= 2 ? 2 : 1
	const weaponCapacity = level >= 3 ? 1 : 0
	const discoveredBlueprints = parsed.discoveredBlueprints ?? []
	return {
		builtFacilities,
		forgeLevel: parsed.forgeLevel ?? 0,
		discoveredBlueprints,
		unseenBlueprints: (parsed.unseenBlueprints ?? []).filter(
			(key) => discoveredBlueprints.includes(key)
		),
		lifetimeDeposited,
		salvageGhostChestStock: clampStock(parsed.salvageGhostChestStock, salvageCapacity),
		weaponGhostChestStock: clampStock(parsed.weaponGhostChestStock, weaponCapacity),
	}
}

function createDefaultProgress(): HubProgress {
	return {
		builtFacilities: ["trainingRange"],
		forgeLevel: 0,
		discoveredBlueprints: [],
		unseenBlueprints: [],
		lifetimeDeposited: 0,
		salvageGhostChestStock: 1,
		weaponGhostChestStock: 0,
	}
}

function clampStock(value: number | undefined, capacity: number) {
	if (value === undefined) return capacity
	return Math.min(capacity, Math.max(0, Math.round(value)))
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.round(amount)
}

function readSavedProgress() {
	if (typeof localStorage === "undefined") return undefined
	return localStorage.getItem(HUB_PROGRESS_KEY) ?? undefined
}

function removeSavedProgress() {
	if (typeof localStorage === "undefined") return
	localStorage.removeItem(HUB_PROGRESS_KEY)
}

function saveProgress() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(HUB_PROGRESS_KEY, JSON.stringify(progress))
}
