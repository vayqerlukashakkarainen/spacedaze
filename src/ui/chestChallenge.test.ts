import assert from "node:assert/strict"
import {
	consumeNextChestDifficulty,
	createChestChallengeConfig,
	normalizeChestChallengeHits,
	setNextChestDifficulty,
} from "./chestChallenge"

const easyLinear = createChestChallengeConfig(1, "linear")
const hardLinear = createChestChallengeConfig(5, "linear")
assert.equal(easyLinear.maxPasses, 3)
assert.equal(hardLinear.maxPasses, 3)
assert.ok(hardLinear.speed > easyLinear.speed)
assert.ok(hardLinear.linearZoneWidth < easyLinear.linearZoneWidth)

const easyBezier = createChestChallengeConfig(1, "bezier")
const hardBezier = createChestChallengeConfig(5, "bezier")
assert.equal(easyBezier.maxPasses, 1)
assert.equal(hardBezier.maxPasses, 1)
assert.ok(hardBezier.speed > easyBezier.speed)
assert.ok(hardBezier.bezierHitWindow < easyBezier.bezierHitWindow)

assert.equal(createChestChallengeConfig(99, "linear").difficulty, 5)
assert.equal(createChestChallengeConfig(-10, "linear").difficulty, 1)
assert.equal(normalizeChestChallengeHits("linear", 1), 1)
assert.equal(normalizeChestChallengeHits("bezier", 0), 0)
assert.equal(normalizeChestChallengeHits("bezier", 1), 3)

setNextChestDifficulty(4)
assert.equal(consumeNextChestDifficulty(), 4)
assert.equal(consumeNextChestDifficulty(), 1)

console.log("Chest challenge tests passed")
