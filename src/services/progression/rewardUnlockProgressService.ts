import { getFloorPositionForDepth } from "../../levels/floorThemes/floorThemeDirectory"
import type { RewardKind } from "../../types/rewardTypes"
import {
	readProfileSection,
	writeProfileSection,
} from "./profileSaveService"
import type { CombatCredit } from "./combatCredit"

export type RewardUnlockMetric =
	| "maxDepth"
	| "totalKills"
	| "criticalKills"
	| "primaryKills"
	| "secondaryKills"
	| "lassoKills"
	| "explosiveKills"

export interface RewardUnlockRequirement {
	metric: RewardUnlockMetric
	target: number
	id?: string
}

export interface RewardUnlockRequirementSet {
	allOf: readonly RewardUnlockRequirement[]
	anyOf?: readonly RewardUnlockRequirement[]
}

interface RewardUnlockProgress {
	version: 1
	maxDepth: number
	totalKills: number
	criticalKills: number
	primaryKills: Record<string, number>
	secondaryKills: Record<string, number>
	lassoKills: number
	explosiveKills: number
}

interface RewardIdentity {
	id: string
	kind: RewardKind
	minimumHubLevel?: number
	upgradeKey?: string
}

const PRIMARY_REQUIREMENTS: Readonly<Record<string, readonly RewardUnlockRequirement[]>> = {
	pulseRepeater: [killsWith("primaryKills", 15, "standardBlaster")],
	twinNeedle: [reachDepth(2), stat("criticalKills", 10)],
	arcCarbine: [stat("totalKills", 30)],
	scatterArray: [reachDepth(4), killsWith("primaryKills", 40)],
	burstDriver: [reachDepth(5), stat("criticalKills", 20)],
	plasmaMortar: [reachDepth(5), stat("explosiveKills", 20)],
	railLance: [reachDepth(7), stat("totalKills", 100)],
	railgun: [reachDepth(9), stat("lassoKills", 15)],
}

const SECONDARY_REQUIREMENTS: Readonly<Record<string, readonly RewardUnlockRequirement[]>> = {
	repulsorPulse: [stat("lassoKills", 3)],
	decoyBeacon: [stat("totalKills", 15)],
	scrapMine: [reachDepth(2)],
	kineticBarrier: [reachDepth(4)],
	gravityCharge: [reachDepth(7)],
	breachCharge: [reachDepth(4), killsWith("secondaryKills", 12, "rocketPod")],
	droneBeacon: [killsWith("secondaryKills", 25)],
	repairPulse: [reachDepth(4)],
	empBeacon: [reachDepth(6), stat("totalKills", 75)],
}

const ABILITY_REQUIREMENTS: Readonly<Record<string, readonly RewardUnlockRequirement[]>> = {
	thrusterOverdrive: [reachDepth(2)],
	phaseJump: [reachDepth(4)],
	retroBurst: [stat("lassoKills", 3)],
	gravitySling: [stat("lassoKills", 10)],
	phaseNova: [reachDepth(10), stat("totalKills", 200)],
}

const EXPLOSIVE_UPGRADE_KEYS = new Set([
	"nrOfRockets",
	"rocketShards",
	"singularityPayload",
	"fragmentationCore",
	"proximityFuse",
	"volatileCorrosion",
	"mineLayer",
])

const CRITICAL_UPGRADE_KEYS = new Set([
	"targetingMatrix",
	"criticalPayload",
	"criticalShatter",
	"executionRounds",
])

let progress = loadProgress()

export function recordRewardFloorReached(depth: number) {
	const normalizedDepth = Math.max(1, Math.floor(depth))
	if (normalizedDepth <= progress.maxDepth) return
	progress.maxDepth = normalizedDepth
	saveProgress()
}

export function recordRewardKill(credit?: CombatCredit) {
	progress.totalKills++
	if (credit?.critical) progress.criticalKills++
	if (credit?.kind === "primary") increment(progress.primaryKills, credit.id)
	if (credit?.kind === "secondary") increment(progress.secondaryKills, credit.id)
	if (credit?.kind === "lasso") progress.lassoKills++
	if (credit?.explosive) progress.explosiveKills++
	saveProgress()
}

export function getRewardUnlockRequirements(
	reward: RewardIdentity
): RewardUnlockRequirementSet | undefined {
	const id = getCatalogId(reward.id)
	if (reward.kind === "weapon" && id === "impactDriver") {
		return {
			allOf: [],
			anyOf: [stat("lassoKills", 5), reachDepth(3)],
		}
	}
	if (reward.kind === "weapon" && id === "breachCannon") {
		return {
			allOf: [],
			anyOf: [
				stat("explosiveKills", 10),
				killsWith("secondaryKills", 12, "rocketPod"),
			],
		}
	}
	let requirements: readonly RewardUnlockRequirement[] = []
	if (reward.kind === "weapon") {
		requirements = PRIMARY_REQUIREMENTS[id] ?? []
	} else if (reward.kind === "activeModule") {
		requirements = SECONDARY_REQUIREMENTS[id] ?? []
	} else if (reward.kind === "mobility" || reward.kind === "ultimate") {
		requirements = ABILITY_REQUIREMENTS[id] ?? []
	} else if (reward.kind === "upgrade") {
		requirements = getUpgradeRequirements(reward)
	} else if (reward.id === "addFollower") {
		requirements = [stat("totalKills", 20)]
	} else if (reward.id === "addPlayerMaxHealth") {
		requirements = [reachDepth(2)]
	} else if (reward.id === "addPrimaryRocketChance") {
		requirements = [stat("criticalKills", 12)]
	}
	return requirements.length > 0 ? { allOf: requirements } : undefined
}

export function meetsRewardUnlockRequirements(
	requirements?: RewardUnlockRequirementSet
) {
	if (!requirements) return true
	const meetsAll = requirements.allOf.every((requirement) =>
		getRewardUnlockRequirementProgress(requirement) >= requirement.target
	)
	const meetsAny = !requirements.anyOf?.length || requirements.anyOf.some(
		(requirement) =>
			getRewardUnlockRequirementProgress(requirement) >= requirement.target
	)
	return meetsAll && meetsAny
}

export function getRewardUnlockRequirementProgress(
	requirement: RewardUnlockRequirement
) {
	switch (requirement.metric) {
		case "maxDepth": return progress.maxDepth
		case "totalKills": return progress.totalKills
		case "criticalKills": return progress.criticalKills
		case "primaryKills": return getCounter(progress.primaryKills, requirement.id)
		case "secondaryKills": return getCounter(progress.secondaryKills, requirement.id)
		case "lassoKills": return progress.lassoKills
		case "explosiveKills": return progress.explosiveKills
	}
}

export function describeRewardUnlockRequirement(
	requirement: RewardUnlockRequirement
) {
	const current = Math.min(
		requirement.target,
		getRewardUnlockRequirementProgress(requirement)
	)
	if (requirement.metric === "maxDepth") {
		const target = formatDepth(requirement.target)
		const reached = progress.maxDepth > 0 ? formatDepth(progress.maxDepth) : "NONE"
		return `REACH FLOOR ${target}  ${reached} / ${target}`
	}
	const label = getMetricLabel(requirement)
	return `${label}  ${current} / ${requirement.target}`
}

export function resetRewardUnlockProgress() {
	progress = createEmptyProgress()
	saveProgress()
}

function getUpgradeRequirements(reward: RewardIdentity) {
	const key = reward.upgradeKey ?? getCatalogId(reward.id)
	if (key === "salvageLasso") return [stat("totalKills", 8)]
	if (EXPLOSIVE_UPGRADE_KEYS.has(key)) return [stat("explosiveKills", 8)]
	if (CRITICAL_UPGRADE_KEYS.has(key)) return [stat("criticalKills", 8)]
	const hubLevel = Math.max(1, Math.round(reward.minimumHubLevel ?? 1))
	if (hubLevel <= 1) return []
	return [reachDepth((hubLevel - 1) * 3 + 1)]
}

function getCatalogId(id: string) {
	const parts = id.split(":")
	if (parts[0] === "upgrade") return parts[1] ?? id
	return parts.at(-1) ?? id
}

function stat(
	metric: Exclude<RewardUnlockMetric, "primaryKills" | "secondaryKills">,
	target: number
): RewardUnlockRequirement {
	return { metric, target }
}

function killsWith(
	metric: "primaryKills" | "secondaryKills",
	target: number,
	id?: string
): RewardUnlockRequirement {
	return { metric, target, id }
}

function reachDepth(target: number): RewardUnlockRequirement {
	return { metric: "maxDepth", target }
}

function increment(counters: Record<string, number>, id?: string) {
	if (!id) return
	counters[id] = (counters[id] ?? 0) + 1
}

function getCounter(counters: Record<string, number>, id?: string) {
	if (id) return counters[id] ?? 0
	return Object.values(counters).reduce((total, value) => total + value, 0)
}

function getMetricLabel(requirement: RewardUnlockRequirement) {
	switch (requirement.metric) {
		case "totalKills": return "HOSTILES DESTROYED"
		case "criticalKills": return "CRITICAL KILLS"
		case "lassoKills": return "LASSO KILLS"
		case "explosiveKills": return "EXPLOSIVE KILLS"
		case "primaryKills": return requirement.id
			? `${formatId(requirement.id)} KILLS`
			: "PRIMARY KILLS"
		case "secondaryKills": return requirement.id
			? `${formatId(requirement.id)} KILLS`
			: "SECONDARY KILLS"
		case "maxDepth": return "FLOOR REACHED"
	}
}

function formatId(id: string) {
	return id.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase()
}

function formatDepth(depth: number) {
	const position = getFloorPositionForDepth(depth)
	return `${position.floor}.${position.subfloor}`
}

function loadProgress(): RewardUnlockProgress {
	const saved = readProfileSection<Partial<RewardUnlockProgress>>("stats")
	const empty = createEmptyProgress()
	if (!saved || saved.version !== 1) {
		empty.totalKills = getLegacyLifetimeKills()
		return empty
	}
	return {
		...empty,
		maxDepth: validCount(saved.maxDepth),
		totalKills: validCount(saved.totalKills),
		criticalKills: validCount(saved.criticalKills),
		primaryKills: validCounters(saved.primaryKills),
		secondaryKills: validCounters(saved.secondaryKills),
		lassoKills: validCount(saved.lassoKills),
		explosiveKills: validCount(saved.explosiveKills),
	}
}

function createEmptyProgress(): RewardUnlockProgress {
	return {
		version: 1,
		maxDepth: 0,
		totalKills: 0,
		criticalKills: 0,
		primaryKills: {},
		secondaryKills: {},
		lassoKills: 0,
		explosiveKills: 0,
	}
}

function validCount(value: number | undefined) {
	return Number.isFinite(value) && value !== undefined && value >= 0
		? Math.floor(value)
		: 0
}

function validCounters(value: Record<string, number> | undefined) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {}
	return Object.fromEntries(
		Object.entries(value).map(([key, count]) => [key, validCount(count)])
	)
}

function saveProgress() {
	writeProfileSection("stats", progress)
}

function getLegacyLifetimeKills() {
	if (typeof localStorage === "undefined") return 0
	const saved = localStorage.getItem("spacedaze_lifetime_stats_v1")
	if (!saved) return 0
	try {
		const parsed = JSON.parse(saved) as { enemiesKilled?: number }
		return validCount(parsed.enemiesKilled)
	} catch {
		return 0
	}
}
