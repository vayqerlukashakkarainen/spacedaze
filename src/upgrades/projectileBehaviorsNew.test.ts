import assert from "node:assert/strict"
import { RewardRarity } from "../types/rewardTypes"
import { getUpgradeDefinition } from "./upgradeRegistry"

const behaviorKeys = [
	"fragmentationCore",
	"hunterGuidance",
	"proximityFuse",
	"afterimageRounds",
	"boomerangPayload",
	"growingCharge",
	"stasisBurst",
	"volatileCorrosion",
	"criticalShatter",
	"executionRounds",
	"targetPainter",
	"mineLayer",
	"voidLance",
]

for (const key of behaviorKeys) {
	const definition = getUpgradeDefinition(key)
	assert.ok(definition, `${key} should be registered`)
	assert.equal(definition.levels.length, 3, `${key} should have three levels`)
	assert.ok(definition.reward, `${key} should be in a reward pool`)
	assert.ok(
		definition.reward.allowedSources.length > 0,
		`${key} should have at least one reward source`
	)
	for (const level of definition.levels) {
		assert.match(level.sprite, /_upg1$/)
		assert.ok(level.effects.modifiers?.length)
	}
}

assert.deepEqual(
	getUpgradeDefinition("stasisBurst")?.requirements?.allOf,
	[{ toolKey: "cryoRounds" }]
)
assert.deepEqual(
	getUpgradeDefinition("volatileCorrosion")?.requirements?.allOf,
	[{ toolKey: "corrosivePayload" }]
)
assert.deepEqual(
	getUpgradeDefinition("criticalShatter")?.requirements?.allOf,
	[{ toolKey: "targetingMatrix" }]
)

const hunterGuidanceDistances = getUpgradeDefinition("hunterGuidance")?.levels.map(
	(level) => level.effects.modifiers?.find(
		(modifier) => modifier.stat === "projectileGuidanceDistance"
	)?.value
)
assert.deepEqual(hunterGuidanceDistances, [140, 220, 320])

const lifesteal = getUpgradeDefinition("lifesteal")
assert.ok(lifesteal, "lifesteal should be registered")
assert.equal(lifesteal.levels.length, 5)
assert.deepEqual(
	lifesteal.levels.map((level) => level.effects.modifiers?.[0]?.value),
	[0.05, 0.075, 0.1, 0.125, 0.15]
)
assert.equal(lifesteal.reward?.minimumHubLevel, 2)

const projectileSpecializations = [
	{
		key: "componentShear",
		stat: "projectilePartDamageMultiplier",
	},
	{
		key: "coreBreach",
		stat: "projectileCoreDamageMultiplier",
	},
]

for (const specialization of projectileSpecializations) {
	const definition = getUpgradeDefinition(specialization.key)
	assert.ok(definition, `${specialization.key} should be registered`)
	assert.equal(definition.reward?.rarity, RewardRarity.Common)
	assert.deepEqual(
		definition.reward?.allowedSources,
		["crate", "enemy", "boss"]
	)
	assert.deepEqual(
		definition.levels.map((level) => {
			const modifier = level.effects.modifiers?.find(
				(candidate) => candidate.stat === specialization.stat
			)
			assert.equal(modifier?.type, "multiply")
			return modifier?.value
		}),
		[1.2, 1.3, 1.4, 1.5, 1.6]
	)
}

const empRounds = getUpgradeDefinition("empRounds")
const stunRounds = getUpgradeDefinition("stunRounds")
assert.ok(empRounds, "EMP rounds should be registered")
assert.ok(stunRounds, "stun rounds should be registered")
assert.equal(empRounds.levels.length, stunRounds.levels.length)
for (let index = 0; index < empRounds.levels.length; index++) {
	const empChance = empRounds.levels[index].effects.modifiers?.find(
		(modifier) => modifier.stat === "projectileEmpChance"
	)?.value ?? 0
	const stunChance = stunRounds.levels[index].effects.modifiers?.find(
		(modifier) => modifier.stat === "projectileStunChance"
	)?.value ?? 0
	assert.ok(empChance > stunChance, `EMP chance should exceed stun at level ${index + 1}`)
}

console.log("Projectile behavior reward tests passed")
