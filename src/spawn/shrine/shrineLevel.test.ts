import assert from "node:assert/strict"
import {
	getShrineLevelConfig,
	MAX_SHRINE_LEVEL,
} from "./shrineLevel"

const firstLevel = getShrineLevelConfig(1, 48)
const maximumLevel = getShrineLevelConfig(MAX_SHRINE_LEVEL, 48)

assert.equal(firstLevel.level, 1)
assert.equal(maximumLevel.level, MAX_SHRINE_LEVEL)
assert.ok(firstLevel.radius > maximumLevel.radius)
assert.ok(firstLevel.radius > 48 * 0.72)
assert.ok(maximumLevel.radius > 48 * 0.72)
assert.ok(firstLevel.captureTime < maximumLevel.captureTime)
assert.ok(firstLevel.enemySpawnInterval > maximumLevel.enemySpawnInterval)
assert.equal(getShrineLevelConfig(99, 48).level, MAX_SHRINE_LEVEL)
assert.equal(getShrineLevelConfig(-5, 48).level, 1)

console.log("Shrine level tests passed")
