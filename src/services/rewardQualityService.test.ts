import assert from "node:assert/strict"
import { RewardRarity } from "../types/rewardTypes"
import {
	getHigherRarity,
	scaleUpgradeEffects,
} from "./rewardQualityService"

const arcEffects = {
	modifiers: [{
		stat: "projectileChainCount",
		value: 2,
		type: "base" as const,
	}],
}

const legendaryArc = scaleUpgradeEffects(
	arcEffects,
	RewardRarity.Rare,
	RewardRarity.Legendary
)
assert.equal(legendaryArc.modifiers?.[0].value, 4)

const rareDamage = scaleUpgradeEffects(
	{
		modifiers: [{
			stat: "blasterDmgMultiplier",
			value: 2,
			type: "multiply",
		}],
	},
	RewardRarity.Uncommon,
	RewardRarity.Rare
)
assert.equal(rareDamage.modifiers?.[0].value, 2.25)

assert.equal(
	getHigherRarity(RewardRarity.Legendary, RewardRarity.Common),
	RewardRarity.Legendary
)
assert.equal(
	getHigherRarity(RewardRarity.Uncommon, RewardRarity.Epic),
	RewardRarity.Epic
)

console.log("reward quality service tests passed")
