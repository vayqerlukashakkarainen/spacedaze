import { Vec2 } from "kaplay"
import { k } from "../main"
import { loadPlayer } from "../player"
import {
	PowerupKey,
	powerupReq,
	powerups,
	powerupsSprites,
} from "../powerups"
import {
	getEffectiveUpgradeLevel,
	getNextRunUpgradeLevel,
	grantRunUpgrade,
	isToolKey,
	addLvl,
	describeUpgradeRequirements,
	getUpgradeRequirementText,
} from "../upg"
import {
	RewardKind,
	RewardRarity,
	RewardSource,
} from "../types/rewardTypes"
import { UpgradeEffect, UpgradeDefinition } from "../types/upgradeTypes"
import {
	getAllUpgradeDefinitions,
} from "../upgrades/upgradeRegistry"

export { RewardRarity }
export type { RewardKind, RewardSource }

export const REWARD_RARITY_COLORS: Readonly<
	Record<RewardRarity, readonly [number, number, number]>
> = {
	[RewardRarity.Common]: [255, 255, 255],
	[RewardRarity.Uncommon]: [80, 220, 120],
	[RewardRarity.Rare]: [70, 150, 255],
	[RewardRarity.Epic]: [190, 90, 255],
}

export interface RewardDefinition {
	id: string
	kind: RewardKind
	name: string
	description: string
	stats: Readonly<Record<string, number | string>>
	sprite: string
	rarity: RewardRarity
	allowedSources: readonly RewardSource[]
	weights: Partial<Record<RewardSource, number>>
	powerupKey?: PowerupKey
	upgradeKey?: string
	levelIndex?: number
	canReceive?: () => boolean
}

export interface Reward {
	id: string
	kind: RewardKind
	name: string
	description: string
	stats: Readonly<Record<string, number | string>>
	sprite: string
	rarity: RewardRarity
	powerupKey?: PowerupKey
	upgradeKey?: string
	levelIndex?: number
}

export interface CrateRewardResult {
	rewards: Reward[]
	failures: number
	quality: number
}

interface RarityWeights {
	common: number
	uncommon: number
	rare: number
	epic: number
}

const CRATE_RARITY_WEIGHTS: RarityWeights[] = [
	{ common: 600, uncommon: 300, rare: 80, epic: 20 },
	{ common: 450, uncommon: 350, rare: 150, epic: 50 },
	{ common: 300, uncommon: 350, rare: 250, epic: 100 },
	{ common: 150, uncommon: 300, rare: 350, epic: 200 },
]

const ENEMY_EMPTY_WEIGHT = 45000

const powerupRewardRegistry: Record<PowerupKey, RewardDefinition> = {
	addFollower: {
		id: "addFollower",
		kind: "powerup",
		powerupKey: "addFollower",
		name: "COMBAT DRONE",
		description: "Spawns a follower drone to fight by your side",
		stats: { followers: "+1" },
		sprite: powerupsSprites.addFollower,
		rarity: RewardRarity.Epic,
		allowedSources: ["crate", "boss"],
		weights: { crate: 350, boss: 400 },
	},
	addPlayerMaxHealth: {
		id: "addPlayerMaxHealth",
		kind: "powerup",
		powerupKey: "addPlayerMaxHealth",
		name: "HULL REINFORCEMENT",
		description: "Increases your maximum health by 1",
		stats: { maxHealth: "+1", healing: "+1" },
		sprite: powerupsSprites.addPlayerMaxHealth,
		rarity: RewardRarity.Rare,
		allowedSources: ["crate", "boss"],
		weights: { crate: 200, boss: 300 },
	},
	addExtraRockets: {
		id: "addExtraRockets",
		kind: "powerup",
		powerupKey: "addExtraRockets",
		name: "MISSILE CACHE",
		description: "Adds 1 extra rocket to your arsenal",
		stats: { extraRockets: "+1" },
		sprite: powerupsSprites.addExtraRockets,
		rarity: RewardRarity.Uncommon,
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 120, enemy: 120, boss: 180 },
		canReceive: powerupReq.addExtraRockets,
	},
	addSpaceDebree: {
		id: "addSpaceDebree",
		kind: "powerup",
		powerupKey: "addSpaceDebree",
		name: "SHRAPNEL PAYLOAD",
		description: "Adds 2 extra shrapnel to your missiles",
		stats: { rocketShards: "+2" },
		sprite: powerupsSprites.addSpaceDebree,
		rarity: RewardRarity.Common,
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 110, enemy: 110, boss: 160 },
		canReceive: powerupReq.addSpaceDebree,
	},
	addPrimaryRocketChance: {
		id: "addPrimaryRocketChance",
		kind: "powerup",
		powerupKey: "addPrimaryRocketChance",
		name: "ROCKET COUPLER",
		description: "Primary fire has a 10% chance to launch a homing rocket whose damage inherits from your primary weapon",
		stats: { procChance: "+10%", damage: "Primary weapon" },
		sprite: powerupsSprites.addPrimaryRocketChance,
		rarity: RewardRarity.Rare,
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 90, enemy: 55, boss: 130 },
	},
	slowdownTime: {
		id: "slowdownTime",
		kind: "powerup",
		powerupKey: "slowdownTime",
		name: "TIME DILATOR",
		description: "Slows down time for 6 seconds",
		stats: { timescale: 0.3, duration: "6s" },
		sprite: powerupsSprites.slowdownTime,
		rarity: RewardRarity.Uncommon,
		allowedSources: ["enemy"],
		weights: { enemy: 130 },
	},
}

export function getRewardDefinitions(
	source?: RewardSource
): RewardDefinition[] {
	return getAllRewardDefinitions(source).filter(canReceiveReward)
}

export function getAllRewardDefinitions(
	source?: RewardSource
): RewardDefinition[] {
	const powerupRewards = Object.values(powerupRewardRegistry)
	const upgradeRewards = getAllUpgradeDefinitions()
		.map(buildCurrentUpgradeReward)
		.filter((reward): reward is RewardDefinition => reward !== undefined)

	return [...powerupRewards, ...upgradeRewards].filter((definition) => {
		return !source || definition.allowedSources.includes(source)
	})
}

export function canReceiveReward(definition: RewardDefinition): boolean {
	return definition.canReceive ? definition.canReceive() : true
}

export function getRewardLockReason(
	definition: RewardDefinition
): string | undefined {
	if (canReceiveReward(definition)) return undefined
	if (definition.upgradeKey && isToolKey(definition.upgradeKey)) {
		const requirement = getUpgradeRequirementText(definition.upgradeKey)
		if (requirement) return `Requires ${requirement}`
		if (getEffectiveUpgradeLevel(definition.upgradeKey) !== undefined) {
			return "Maximum level reached"
		}
	}
	return "Requirements not met"
}

export function getRewardDefinition(id: string): RewardDefinition | undefined {
	const normalizedId = id.toLowerCase()
	const powerupKey = Object.keys(powerupRewardRegistry).find(
		(key) => key.toLowerCase() === normalizedId
	) as PowerupKey | undefined
	const powerup = powerupKey ? powerupRewardRegistry[powerupKey] : undefined
	if (powerup) return powerup

	const currentUpgrade = getAllUpgradeDefinitions().find(
		(definition) => definition.toolKey.toLowerCase() === normalizedId
	)
	if (currentUpgrade) return buildCurrentUpgradeReward(currentUpgrade)

	const match = /^(?:upgrade:)?([^:]+):(\d+)$/.exec(id)
	if (!match) return undefined
	const definition = getAllUpgradeDefinitions().find(
		(candidate) => candidate.toolKey.toLowerCase() === match[1].toLowerCase()
	)
	if (!definition) return undefined
	return buildUpgradeReward(definition, Number(match[2]) - 1)
}

export function createReward(id: string): Reward | undefined {
	return toReward(getRewardDefinition(id))
}

export function rollCrateReward(successfulHits: number): Reward | undefined {
	return rollCrateRewardForQuality(successfulHits, [])
}

export function rollCrateRewardChoices(
	successfulHits: number,
	failedAttempts: number
): CrateRewardResult {
	const missedZones = Math.max(0, 3 - Math.floor(successfulHits))
	const failures = Math.max(0, Math.floor(failedAttempts)) + missedZones
	const quality = k.clamp(3 - failures, 0, 3)
	const choiceCount = failures === 0 ? 3 : failures <= 2 ? 2 : 1
	const rewards: Reward[] = []

	for (let index = 0; index < choiceCount; index++) {
		const reward = rollCrateRewardForQuality(
			quality,
			rewards.map((current) => current.id)
		)
		if (!reward) break
		rewards.push(reward)
	}

	return { rewards, failures, quality }
}

export function rollDropReward(
	source: "enemy" | "boss",
	chanceMultiplier: number = 1
): Reward | undefined {
	const available = getRewardDefinitions(source)
	if (available.length === 0) return undefined

	const multiplier = Number.isFinite(chanceMultiplier)
		? Math.max(0, chanceMultiplier)
		: 1
	const rewardWeight = available.reduce(
		(total, reward) => total + (reward.weights[source] ?? 0) * multiplier,
		0
	)
	const emptyWeight = source === "enemy" ? ENEMY_EMPTY_WEIGHT : 0
	const roll = k.rand(0, rewardWeight + emptyWeight)
	if (roll < emptyWeight) return undefined

	return toReward(pickWeighted(available, source, multiplier))
}

export function applyReward(reward: Reward, pos: Vec2): boolean {
	if (reward.kind === "powerup" && reward.powerupKey) {
		powerups[reward.powerupKey](pos)
		return true
	}

	if (reward.kind === "upgrade" && reward.upgradeKey !== undefined) {
		if (!isToolKey(reward.upgradeKey)) return false
		if (getNextRunUpgradeLevel(reward.upgradeKey) !== reward.levelIndex) {
			return false
		}
		if (reward.upgradeKey === "blaster") {
			addLvl("blaster")
			loadPlayer()
			return true
		}
		const grantedLevel = grantRunUpgrade(reward.upgradeKey)
		if (grantedLevel === undefined) return false
		loadPlayer()
		return true
	}

	return false
}

function buildCurrentUpgradeReward(
	definition: UpgradeDefinition
): RewardDefinition | undefined {
	if (!definition.reward || !isToolKey(definition.toolKey)) return undefined
	const currentLevel = getEffectiveUpgradeLevel(definition.toolKey) ?? -1
	const levelIndex = Math.min(currentLevel + 1, definition.levels.length - 1)
	if (levelIndex < 0) return undefined
	return buildUpgradeReward(definition, levelIndex)
}

function buildUpgradeReward(
	definition: UpgradeDefinition,
	levelIndex: number
): RewardDefinition | undefined {
	const policy = definition.reward
	const level = definition.levels[levelIndex]
	const toolKey = definition.toolKey
	if (!policy || !level || !isToolKey(toolKey)) return undefined
	const requirementText = describeUpgradeRequirements(definition)

	return {
		id: `upgrade:${toolKey}:${levelIndex + 1}`,
		kind: "upgrade",
		upgradeKey: toolKey,
		levelIndex,
		name: `${definition.toolName.toUpperCase()} ${level.name.toUpperCase()}`,
		description: requirementText
			? `${level.desc}\nREQUIRES: ${requirementText}`
			: level.desc,
		stats: formatUpgradeStats(level.effects),
		sprite: level.sprite,
		rarity: policy.rarity,
		allowedSources: policy.allowedSources,
		weights: policy.weights,
		canReceive: () => getNextRunUpgradeLevel(toolKey) === levelIndex,
	}
}

function formatUpgradeStats(
	effects: UpgradeEffect
): Readonly<Record<string, number | string>> {
	const stats: Record<string, number | string> = {}
	for (const modifier of effects.modifiers ?? []) {
		if (modifier.stat === "critChance") {
			stats[modifier.stat] = `${modifier.value}%`
			continue
		}
		if (modifier.stat === "critMultiplier") {
			stats[modifier.stat] = `${modifier.value}x`
			continue
		}
		const prefix = modifier.type === "multiply" ? "x" : modifier.type === "additive" ? "+" : "="
		stats[modifier.stat] = `${prefix}${modifier.value}`
	}
	if (effects.unlocks?.length) {
		stats.unlock = effects.unlocks.map((unlock) => unlock.unlockId).join(",")
	}
	if (effects.abilities?.length) {
		stats.ability = effects.abilities.map((ability) => ability.abilityId).join(",")
	}
	return stats
}

function rollCrateRarity(successfulHits: number): RewardRarity {
	const hitIndex = k.clamp(Math.floor(successfulHits), 0, 3)
	const weights = CRATE_RARITY_WEIGHTS[hitIndex]
	const total = weights.common + weights.uncommon + weights.rare + weights.epic
	const roll = k.rand(0, total)

	if (roll < weights.common) return RewardRarity.Common
	if (roll < weights.common + weights.uncommon) return RewardRarity.Uncommon
	if (roll < weights.common + weights.uncommon + weights.rare) {
		return RewardRarity.Rare
	}
	return RewardRarity.Epic
}

function rollCrateRewardForQuality(
	quality: number,
	excludedIds: readonly string[]
): Reward | undefined {
	const rarity = rollCrateRarity(quality)
	const available = getRewardDefinitions("crate").filter(
		(reward) => !excludedIds.includes(reward.id)
	)
	const matching = available.filter((reward) => reward.rarity === rarity)
	const pool = matching.length > 0
		? matching
		: getNearestRarityPool(available, rarity)
	return toReward(pickWeighted(pool, "crate"))
}

function getNearestRarityPool(
	rewards: RewardDefinition[],
	target: RewardRarity
): RewardDefinition[] {
	const order = [
		RewardRarity.Common,
		RewardRarity.Uncommon,
		RewardRarity.Rare,
		RewardRarity.Epic,
	]
	const targetIndex = order.indexOf(target)
	for (let distance = 1; distance < order.length; distance++) {
		const lower = order[targetIndex - distance]
		const higher = order[targetIndex + distance]
		const nearby = rewards.filter(
			(reward) => reward.rarity === lower || reward.rarity === higher
		)
		if (nearby.length > 0) return nearby
	}
	return rewards
}

function pickWeighted(
	rewards: RewardDefinition[],
	source: RewardSource,
	multiplier: number = 1
): RewardDefinition | undefined {
	if (rewards.length === 0) return undefined
	const total = rewards.reduce(
		(sum, reward) => sum + (reward.weights[source] ?? 0) * multiplier,
		0
	)
	if (total <= 0) return rewards[Math.floor(k.rand(0, rewards.length))]

	let roll = k.rand(0, total)
	for (const reward of rewards) {
		roll -= (reward.weights[source] ?? 0) * multiplier
		if (roll <= 0) return reward
	}
	return rewards[rewards.length - 1]
}

function toReward(definition: RewardDefinition | undefined): Reward | undefined {
	if (!definition) return undefined
	return {
		id: definition.id,
		kind: definition.kind,
		name: definition.name,
		description: definition.description,
		stats: definition.stats,
		sprite: definition.sprite,
		rarity: definition.rarity,
		powerupKey: definition.powerupKey,
		upgradeKey: definition.upgradeKey,
		levelIndex: definition.levelIndex,
	}
}
