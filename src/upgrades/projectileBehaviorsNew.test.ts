import assert from "node:assert/strict"
import { getUpgradeDefinition } from "./upgradeRegistry"

const behaviorKeys = [
	"fragmentationCore",
	"hunterGuidance",
	"proximityFuse",
	"afterimageRounds",
	"boomerangPayload",
	"growingCharge",
	"momentumCore",
	"orbitingRounds",
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

console.log("Projectile behavior reward tests passed")
