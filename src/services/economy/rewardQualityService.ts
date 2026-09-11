import { RewardRarity } from "../../types/rewardTypes"
import type { StatModifier, UpgradeEffect } from "../../types/upgradeTypes"

export const REWARD_RARITY_ORDER = [
	RewardRarity.Common,
	RewardRarity.Uncommon,
	RewardRarity.Rare,
	RewardRarity.Epic,
	RewardRarity.Legendary,
] as const

const DISCRETE_STATS = new Set([
	"blasterCount",
	"rocketCount",
	"rocketShards",
	"projectilePierces",
	"projectileChainCount",
	"projectileSplitCount",
	"projectileBounceCount",
	"projectileFragmentCount",
	"projectileEchoCount",
	"projectileCriticalShards",
	"projectilePhasePierces",
	"missileDroneSlots",
	"gunshipDroneSlots",
	"medicDroneSlots",
	"salvagerDroneSlots",
])

export function getRarityRank(rarity: RewardRarity) {
	return REWARD_RARITY_ORDER.indexOf(rarity)
}

export function getHigherRarity(
	current: RewardRarity | undefined,
	next: RewardRarity
) {
	if (!current) return next
	return getRarityRank(next) > getRarityRank(current) ? next : current
}

export function clampRewardRarity(
	rarity: RewardRarity,
	min: RewardRarity,
	max: RewardRarity
) {
	const rank = Math.max(
		getRarityRank(min),
		Math.min(getRarityRank(max), getRarityRank(rarity))
	)
	return REWARD_RARITY_ORDER[rank]
}

export function scaleUpgradeEffects(
	effects: UpgradeEffect,
	baseRarity: RewardRarity,
	rarity: RewardRarity
): UpgradeEffect {
	const qualitySteps = Math.max(
		0,
		getRarityRank(rarity) - getRarityRank(baseRarity)
	)
	if (qualitySteps === 0 || !effects.modifiers?.length) return effects
	return {
		...effects,
		modifiers: effects.modifiers.map((modifier) => ({
			...modifier,
			value: scaleModifierValue(modifier, qualitySteps),
		})),
	}
}

export function formatScaledUpgradeDescription(
	description: string,
	baseEffects: UpgradeEffect,
	scaledEffects: UpgradeEffect
) {
	let result = description
	for (let index = 0; index < (baseEffects.modifiers?.length ?? 0); index++) {
		const base = baseEffects.modifiers?.[index]?.value
		const scaled = scaledEffects.modifiers?.[index]?.value
		if (base === undefined || scaled === undefined || base === scaled) continue
		const basePercent = `${Math.round(base * 100)}%`
		const scaledPercent = `${Math.round(scaled * 100)}%`
		const percentResult = replaceExactNumberToken(
			result,
			basePercent,
			scaledPercent
		)
		if (percentResult !== result) {
			result = percentResult
			continue
		}
		result = replaceExactNumberToken(result, String(base), String(scaled))
	}
	return result
}

function replaceExactNumberToken(
	value: string,
	token: string,
	replacement: string
) {
	const pattern = new RegExp(
		`(^|[^\\d.])${escapeRegExp(token)}(?![\\d.])`
	)
	return value.replace(pattern, (_match, prefix: string) =>
		`${prefix}${replacement}`
	)
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function scaleModifierValue(modifier: StatModifier, qualitySteps: number) {
	if (DISCRETE_STATS.has(modifier.stat)) {
		return modifier.value + qualitySteps
	}
	const qualityMultiplier = 1 + qualitySteps * 0.25
	if (
		modifier.stat === "projectileModifierChance" ||
		modifier.stat === "projectileModifierChanceBonus"
	) {
		return Math.min(1, roundQualityValue(modifier.value * qualityMultiplier))
	}
	if (modifier.type === "multiply" && modifier.value >= 1) {
		return roundQualityValue(
			1 + (modifier.value - 1) * qualityMultiplier
		)
	}
	return roundQualityValue(modifier.value * qualityMultiplier)
}

function roundQualityValue(value: number) {
	return Math.round(value * 1000) / 1000
}
