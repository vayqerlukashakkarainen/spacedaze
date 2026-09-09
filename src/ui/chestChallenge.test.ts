import assert from "node:assert/strict"
import {
	consumeNextChestDifficulty,
	consumeNextChestRewardCollectedCallback,
	consumeNextChestWorldOpenAnimation,
	consumeNextChestWorldPosition,
	createChestChallengeConfig,
	normalizeChestChallengeHits,
	setNextChestDifficulty,
	setNextChestRewardCollectedCallback,
	setNextChestWorldOpenAnimation,
	setNextChestWorldPosition,
} from "./chestChallenge"
import type { Vec2 } from "kaplay"

const fixedVariation = { random: () => 0.5 }
const easyLinear = createChestChallengeConfig(1, "linear", fixedVariation)
const hardLinear = createChestChallengeConfig(5, "linear", fixedVariation)
assert.equal(easyLinear.maxPasses, 2)
assert.equal(hardLinear.maxPasses, 1)
assert.ok(hardLinear.speed > easyLinear.speed)
assert.ok(hardLinear.linearZoneWidth < easyLinear.linearZoneWidth)

const easyBezier = createChestChallengeConfig(1, "bezier", fixedVariation)
const hardBezier = createChestChallengeConfig(5, "bezier", fixedVariation)
assert.equal(easyBezier.maxPasses, 1)
assert.equal(hardBezier.maxPasses, 1)
assert.ok(hardBezier.speed > easyBezier.speed)
assert.ok(hardBezier.bezierHitWindow < easyBezier.bezierHitWindow)
assert.ok(easyBezier.bezierSegmentCount >= 2)
assert.ok(hardBezier.bezierSegmentCount > easyBezier.bezierSegmentCount)

const easyFrequency = createChestChallengeConfig(1, "frequency", fixedVariation)
const hardFrequency = createChestChallengeConfig(5, "frequency", fixedVariation)
assert.ok(hardFrequency.frequencyHitWindow < easyFrequency.frequencyHitWindow)
assert.ok(hardFrequency.frequencyTuneSpeed > easyFrequency.frequencyTuneSpeed)
assert.ok(hardFrequency.frequencyTimeLimit < easyFrequency.frequencyTimeLimit)

const easyCapacitor = createChestChallengeConfig(1, "capacitor", fixedVariation)
const hardCapacitor = createChestChallengeConfig(5, "capacitor", fixedVariation)
assert.ok(hardCapacitor.capacitorChargeSpeed > easyCapacitor.capacitorChargeSpeed)
assert.ok(easyCapacitor.capacitorPerfectCharge < 0.8)
assert.ok(easyCapacitor.capacitorPerfectMax > 0.8)
assert.ok(hardCapacitor.capacitorPerfectMax - hardCapacitor.capacitorPerfectCharge <
	easyCapacitor.capacitorPerfectMax - easyCapacitor.capacitorPerfectCharge)
assert.ok(hardCapacitor.capacitorTimeLimit < easyCapacitor.capacitorTimeLimit)

const lowTarget = createChestChallengeConfig(3, "capacitor", {
	random: sequenceRandom([0, 0, 0]),
})
const highTarget = createChestChallengeConfig(3, "capacitor", {
	random: sequenceRandom([1, 0, 0]),
})
assert.ok(lowTarget.capacitorPerfectCharge < highTarget.capacitorPerfectCharge)
assert.ok(lowTarget.capacitorPerfectMax < highTarget.capacitorPerfectMax)

assert.equal(createChestChallengeConfig(99, "linear").difficulty, 5)
assert.equal(createChestChallengeConfig(-10, "linear").difficulty, 1)
assert.equal(normalizeChestChallengeHits("linear", 1), 1)
assert.equal(normalizeChestChallengeHits("bezier", 0), 0)
assert.equal(normalizeChestChallengeHits("bezier", 1), 3)
assert.equal(normalizeChestChallengeHits("frequency", 2), 2)
assert.equal(normalizeChestChallengeHits("capacitor", 3), 3)

setNextChestDifficulty(4)
assert.equal(consumeNextChestDifficulty(), 4)
assert.equal(consumeNextChestDifficulty(), 1)

const chestPosition = testPosition(120, 240)
setNextChestWorldPosition(chestPosition)
chestPosition.x = 999
const consumedPosition = consumeNextChestWorldPosition()
assert.equal(consumedPosition?.x, 120)
assert.equal(consumedPosition?.y, 240)
assert.equal(consumeNextChestWorldPosition(), undefined)

const chestOpenAnimation = async () => {}
setNextChestWorldOpenAnimation(chestOpenAnimation)
assert.equal(consumeNextChestWorldOpenAnimation(), chestOpenAnimation)
assert.equal(consumeNextChestWorldOpenAnimation(), undefined)

const rewardCollectedCallback = () => {}
setNextChestRewardCollectedCallback(rewardCollectedCallback)
assert.equal(consumeNextChestRewardCollectedCallback(), rewardCollectedCallback)
assert.equal(consumeNextChestRewardCollectedCallback(), undefined)

console.log("Chest challenge tests passed")

function sequenceRandom(values: number[]) {
	let index = 0
	return () => values[index++] ?? values[values.length - 1] ?? 0
}

function testPosition(x: number, y: number): Vec2 {
	return {
		x,
		y,
		clone: () => testPosition(x, y),
	} as Vec2
}
