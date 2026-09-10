import {
	getEffectiveUpgradeLevel,
	getEffectiveUpgradeRarity,
	isToolKey,
} from "../upg"
import {
	getHigherRarity,
	scaleUpgradeEffects,
} from "../services/economy/rewardQualityService"
import type { Reward } from "../services/economy/rewardService"
import type { StatModifier } from "../types/upgradeTypes"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"
import type { UiStatRow } from "./common"
import { getTacticalUplinkHullThreshold } from "../services/abilities/tacticalUplinkService"
import { BASE_PLAYER_HEALTH } from "../services/player/playerHealthBalance"

const BASE_STAT_VALUES: Readonly<Record<string, number>> = {
	blasterCount: 1,
	followerBlasterDmg: 1,
	maxHealth: BASE_PLAYER_HEALTH,
	rocketCount: 3,
	rocketShards: 0,
}

const STAT_LABELS: Readonly<Record<string, string>> = {
	blasterCount: "PRIMARY PROJECTILES",
	blasterDmgMultiplier: "PRIMARY DAMAGE",
	blasterSpeedMultiplier: "PROJECTILE SPEED",
	critChance: "CRITICAL CHANCE",
	critMultiplier: "CRITICAL DAMAGE",
	debreeSeekDistanceMultiplier: "COLLECTION RANGE",
	debreeValueMultiplier: "SALVAGE VALUE",
	followerBlasterDmg: "DRONE DAMAGE",
	maxHealth: "MAX HULL",
	projectileBounceDamageRetention: "BOUNCE DAMAGE",
	projectileCriticalShardDamage: "SHARD DAMAGE",
	projectileDotDamage: "DAMAGE PER TICK",
	projectileEchoDamage: "ECHO DAMAGE",
	projectileExecutionDamage: "EXECUTION DAMAGE",
	projectileFragmentDamage: "FRAGMENT DAMAGE",
	projectileGrowthDamage: "MAX DAMAGE",
	projectileLifesteal: "HEALTH RETURN",
	projectileMineDamage: "MINE DAMAGE",
	projectilePaintDamage: "BONUS DAMAGE",
	projectilePaintStacks: "MAX MARK STACKS",
	projectileProximityDamage: "BLAST DAMAGE",
	projectileVolatileDamage: "BURST DAMAGE",
	rocketCount: "ROCKETS",
	rocketShards: "SHRAPNEL",
	speedMultiplier: "MOVE SPEED",
	sprintSpeedMultiplier: "OVERCLOCK SPEED",
}

const PERCENTAGE_STATS = new Set([
	"projectileBounceDamageRetention",
	"projectileCriticalShardDamage",
	"projectileDotDamage",
	"projectileEchoDamage",
	"projectileExecutionDamage",
	"projectileFragmentDamage",
	"projectileGrowthDamage",
	"projectileLifesteal",
	"projectileMineDamage",
	"projectilePaintDamage",
	"projectileProximityDamage",
	"projectileSlowPercentage",
	"projectileVolatileDamage",
])

const MULTIPLIER_STATS = new Set([
	"critMultiplier",
	"projectileGrowthScale",
])

export function getRewardStatComparisonRows(reward: Reward): UiStatRow[] {
	const upgradeRows = getUpgradeComparisonRows(reward)
	if (upgradeRows.length > 0) return upgradeRows

	const rows = Object.entries(reward.stats)
		.filter(([label]) => label.toUpperCase() !== "SLOT")
		.slice(0, 3)
		.map(([label, value]) => ({
			label: formatStatLabel(label),
			value: `-- > ${formatRewardValue(value)}`,
		}))

	if (rows.length === 0 && reward.progression.repeatability === "once") {
		return [{ label: "UNLOCK", value: "LOCKED > READY" }]
	}
	return rows
}

function getUpgradeComparisonRows(reward: Reward): UiStatRow[] {
	if (!reward.upgradeKey || reward.levelIndex === undefined) return []
	if (!isToolKey(reward.upgradeKey)) return []

	const definition = getUpgradeDefinition(reward.upgradeKey)
	const nextLevel = definition?.levels[reward.levelIndex]
	if (!definition || !nextLevel) return []

	const currentLevelIndex = getEffectiveUpgradeLevel(reward.upgradeKey) ?? -1
	if (reward.upgradeKey === "tacticalUplink") {
		const baseRarity = definition.reward?.rarity
		const currentRarity = getEffectiveUpgradeRarity(reward.upgradeKey) ?? baseRarity
		const nextRarity = getHigherRarity(currentRarity, reward.rarity)
		const baseDamageEffects = definition.levels[0].effects
		const currentDamageEffects = currentLevelIndex >= 0 && baseRarity && currentRarity
			? scaleUpgradeEffects(baseDamageEffects, baseRarity, currentRarity)
			: undefined
		const nextDamageEffects = baseRarity
			? scaleUpgradeEffects(baseDamageEffects, baseRarity, nextRarity)
			: baseDamageEffects
		const currentDamageMultiplier = currentDamageEffects?.modifiers?.find(
			(modifier) => modifier.stat === "tacticalUplinkMultiplier"
		)?.value
		const nextDamageMultiplier = nextDamageEffects.modifiers?.find(
			(modifier) => modifier.stat === "tacticalUplinkMultiplier"
		)?.value
		const currentThreshold = currentLevelIndex < 0
			? "--"
			: formatPercentage(
				getTacticalUplinkHullThreshold(currentLevelIndex) * 100
			)
		const nextThreshold = formatPercentage(
			getTacticalUplinkHullThreshold(reward.levelIndex) * 100
		)
		return [
			{
				label: "DAMAGE BONUS",
				value: `${currentDamageMultiplier === undefined
					? "--"
					: formatPercentage((currentDamageMultiplier - 1) * 100)} > ${formatPercentage(((nextDamageMultiplier ?? 1) - 1) * 100)}`,
			},
			{
				label: "HULL THRESHOLD",
				value: `${currentThreshold} > ${nextThreshold}`,
			},
			{
				label: "STACK",
				value: `${currentLevelIndex + 1} > ${reward.levelIndex + 1}`,
			},
		]
	}
	const baseRarity = definition.reward?.rarity
	const currentRarity = getEffectiveUpgradeRarity(reward.upgradeKey) ?? baseRarity
	const nextRarity = getHigherRarity(currentRarity, reward.rarity)
	const currentLevel = definition.levels[currentLevelIndex]
	const currentEffects = currentLevel && baseRarity && currentRarity
		? scaleUpgradeEffects(currentLevel.effects, baseRarity, currentRarity)
		: currentLevel?.effects
	const nextEffects = baseRarity
		? scaleUpgradeEffects(nextLevel.effects, baseRarity, nextRarity)
		: nextLevel.effects

	const rows = (nextEffects.modifiers ?? []).slice(0, 3).map((modifier) => {
		const currentModifier = currentEffects?.modifiers?.find(
			(candidate) => candidate.stat === modifier.stat
		)
		const currentValue = currentModifier?.value ?? getBaseStatValue(modifier)
		return {
			label: formatStatLabel(modifier.stat),
			value: `${formatModifierValue(modifier, currentValue)} > ${formatModifierValue(modifier, modifier.value)}`,
		}
	})

	if (rows.length === 0) {
		rows.push({ label: "UNLOCK", value: "LOCKED > READY" })
	}
	if (reward.progression.repeatability === "stack") {
		rows.push({
			label: "STACK",
			value: `${currentLevelIndex + 1} > ${reward.levelIndex + 1}`,
		})
	}
	return rows
}

function getBaseStatValue(modifier: StatModifier) {
	if (BASE_STAT_VALUES[modifier.stat] !== undefined) {
		return BASE_STAT_VALUES[modifier.stat]
	}
	return modifier.type === "multiply" ? 1 : 0
}

function formatModifierValue(modifier: StatModifier, value: number) {
	if (modifier.type === "multiply" || modifier.stat.endsWith("Multiplier")) {
		return formatPercentage((value - 1) * 100)
	}
	if (modifier.stat === "critChance") return formatPercentage(value)
	if (PERCENTAGE_STATS.has(modifier.stat)) return formatPercentage(value * 100)
	if (MULTIPLIER_STATS.has(modifier.stat)) return `x${formatNumber(value)}`
	if (/Duration|Delay/.test(modifier.stat)) return `${formatNumber(value)}s`
	if (/Radius|Distance/.test(modifier.stat)) return `${formatNumber(value)}px`
	return formatNumber(value)
}

function formatRewardValue(value: number | string) {
	if (typeof value === "number") return formatNumber(value)
	return value.startsWith("=") ? value.slice(1) : value
}

function formatStatLabel(stat: string) {
	return STAT_LABELS[stat] ?? stat
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")
		.toUpperCase()
}

function formatPercentage(value: number) {
	return `${Math.round(value)}%`
}

function formatNumber(value: number) {
	if (Number.isInteger(value)) return `${value}`
	return `${Math.round(value * 100) / 100}`
}
