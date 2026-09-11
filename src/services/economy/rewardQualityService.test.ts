import assert from "node:assert/strict"
import { RewardRarity } from "../../types/rewardTypes"
import {
	formatScaledUpgradeDescription,
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

const cappedModifierChance = scaleUpgradeEffects(
	{
		modifiers: [{
			stat: "projectileModifierChance",
			value: 0.8,
			type: "base" as const,
		}],
	},
	RewardRarity.Common,
	RewardRarity.Legendary
)
assert.equal(cappedModifierChance.modifiers?.[0].value, 1)

const targetPainterEffects = {
	modifiers: [
		{ stat: "projectilePaintDamage", value: 0.08, type: "base" as const },
		{ stat: "projectilePaintStacks", value: 3, type: "base" as const },
		{ stat: "projectileModifierChance", value: 0.18, type: "base" as const },
	],
}
const epicTargetPainterEffects = scaleUpgradeEffects(
	targetPainterEffects,
	RewardRarity.Uncommon,
	RewardRarity.Epic
)
assert.equal(
	formatScaledUpgradeDescription(
		"18% chance to load painter rounds that mark targets for 8% bonus damage per stack",
		targetPainterEffects,
		epicTargetPainterEffects
	),
	"27% chance to load painter rounds that mark targets for 12% bonus damage per stack"
)

assert.equal(
	getHigherRarity(RewardRarity.Legendary, RewardRarity.Common),
	RewardRarity.Legendary
)
assert.equal(
	getHigherRarity(RewardRarity.Uncommon, RewardRarity.Epic),
	RewardRarity.Epic
)

console.log("reward quality service tests passed")
