import { RewardRarity } from "../../types/rewardTypes"
import type { AbilityId, AbilitySlot } from "./abilityLoadoutService"
import {
	getRarityRank,
	REWARD_RARITY_ORDER,
} from "../economy/rewardQualityService"

export interface AbilityTierValues {
	power: number
	speed: number
	recovery: number
}

export interface AbilityTierState {
	abilityId: AbilityId
	slot: AbilitySlot
	rarity: RewardRarity
	values: AbilityTierValues
}

const DEFAULT_VALUES: AbilityTierValues = {
	power: 1,
	speed: 1,
	recovery: 1,
}

const abilityTiers = new Map<AbilityId, AbilityTierState>()

const TIER_RANGES: Readonly<Record<RewardRarity, readonly [number, number]>> = {
	[RewardRarity.Common]: [0.96, 1.04],
	[RewardRarity.Uncommon]: [1.1, 1.18],
	[RewardRarity.Rare]: [1.24, 1.34],
	[RewardRarity.Epic]: [1.42, 1.56],
	[RewardRarity.Legendary]: [1.68, 1.88],
}

export function beginAbilityTierRun(preserveExisting = false) {
	if (!preserveExisting) abilityTiers.clear()
}

export function endAbilityTierRun() {
	abilityTiers.clear()
}

export function rollAbilityTierState(
	abilityId: AbilityId,
	slot: AbilitySlot,
	rarity: RewardRarity,
	random: () => number = Math.random
): AbilityTierState {
	return {
		abilityId,
		slot,
		rarity,
		values: {
			power: rollTierValue(rarity, random),
			speed: rollTierValue(rarity, random),
			recovery: rollTierValue(rarity, random),
		},
	}
}

export function registerAbilityTier(state: AbilityTierState) {
	if (state.slot === "primary") return false
	const current = abilityTiers.get(state.abilityId)
	if (current && getRarityRank(current.rarity) > getRarityRank(state.rarity)) {
		return false
	}
	abilityTiers.set(state.abilityId, cloneTier(state))
	return true
}

export function getAbilityTierState(abilityId: AbilityId): AbilityTierState | undefined {
	const state = abilityTiers.get(abilityId)
	return state ? cloneTier(state) : undefined
}

export function getAbilityTierValues(abilityId: AbilityId | undefined): AbilityTierValues {
	if (!abilityId) return { ...DEFAULT_VALUES }
	return { ...(abilityTiers.get(abilityId)?.values ?? DEFAULT_VALUES) }
}

export function getAbilityTierRarity(
	abilityId: AbilityId,
	fallback: RewardRarity = RewardRarity.Common
) {
	return abilityTiers.get(abilityId)?.rarity ?? fallback
}

export function getNextAbilityTierRarity(
	abilityId: AbilityId,
	fallback: RewardRarity = RewardRarity.Common
) {
	const current = getAbilityTierRarity(abilityId, fallback)
	const next = getRarityRank(current) + 1
	return REWARD_RARITY_ORDER[next]
}

export function upgradeAbilityTier(
	abilityId: AbilityId,
	slot: AbilitySlot,
	fallback: RewardRarity = RewardRarity.Common,
	random: () => number = Math.random
) {
	if (slot === "primary") return undefined
	const rarity = getNextAbilityTierRarity(abilityId, fallback)
	if (!rarity) return undefined
	const state = rollAbilityTierState(abilityId, slot, rarity, random)
	registerAbilityTier(state)
	return state
}

function rollTierValue(rarity: RewardRarity, random: () => number) {
	const [minimum, maximum] = TIER_RANGES[rarity]
	return round(minimum + (maximum - minimum) * clamp01(random()))
}

function clamp01(value: number) {
	if (!Number.isFinite(value)) return 0.5
	return Math.max(0, Math.min(1, value))
}

function round(value: number) {
	return Math.round(value * 1000) / 1000
}

function cloneTier(state: AbilityTierState): AbilityTierState {
	return {
		...state,
		values: { ...state.values },
	}
}
