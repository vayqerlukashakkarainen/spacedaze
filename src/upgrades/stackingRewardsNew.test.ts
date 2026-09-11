import assert from "node:assert/strict"
import {
	phaseCounter,
	resonanceCoil,
	tacticalUplink,
	threatReactor,
	wreckHarvester,
} from "./stackingRewardsNew"

const rewards = [
	tacticalUplink,
	phaseCounter,
	threatReactor,
	resonanceCoil,
	wreckHarvester,
]

for (const reward of rewards) {
	assert.equal(reward.levels.length, 5, `${reward.toolKey} should stack five times`)
	for (const [index, level] of reward.levels.entries()) {
		assert.ok(level.sprite.length > 0)
		assert.ok(level.effects.modifiers?.[0])
		assert.match(level.desc, new RegExp(`Stack ${index + 1}/5`))
	}
}

assert.deepEqual(
	tacticalUplink.levels.map((level) => level.effects.modifiers?.[0].value),
	[1.4, 1.7, 2, 2.3, 2.6]
)
assert.deepEqual(
	wreckHarvester.levels.map((level) => level.effects.modifiers?.[0].value),
	[0.5, 0.75, 1, 1.25, 1.5]
)

console.log("Stacking reward tests passed")
