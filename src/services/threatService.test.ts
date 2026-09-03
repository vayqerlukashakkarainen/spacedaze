import assert from "node:assert/strict"
import {
	createEnemySpawnProfile,
	getThreatSnapshot,
	scaleThreatSpawnCount,
	setThreatTier,
	startThreatLevel,
	stopThreatLevel,
	updateThreatLevel,
} from "./threatService"

stopThreatLevel()
const inactiveProfile = createEnemySpawnProfile(10, 2, 1, {}, 0)
assert.equal(inactiveProfile.hp, 10)
assert.equal(inactiveProfile.damage, 2)
assert.equal(inactiveProfile.elite, false)

startThreatLevel(1)
assert.equal(getThreatSnapshot().tier, 1)
updateThreatLevel(75)
assert.equal(getThreatSnapshot().tier, 2)
assert.equal(scaleThreatSpawnCount(10), 12)

const eliteProfile = createEnemySpawnProfile(10, 2, 1, {}, 0)
assert.equal(eliteProfile.elite, true)
assert.ok(Math.abs(eliteProfile.hp - 18.7) < 0.0001)
assert.ok(Math.abs(eliteProfile.damage - 2.889) < 0.0001)
assert.equal(eliteProfile.scale, 1.12)
assert.deepEqual(eliteProfile.tint, [105, 175, 255])

setThreatTier(5)
const maximumThreat = getThreatSnapshot()
assert.equal(maximumThreat.tier, 5)
assert.equal(maximumThreat.eliteChance, 0.34)
assert.equal(maximumThreat.spawnCountMultiplier, 1.72)

setThreatTier(undefined)
assert.equal(getThreatSnapshot().tier, 2)

stopThreatLevel()
startThreatLevel(4)
assert.equal(getThreatSnapshot().tier, 2)
stopThreatLevel()

console.log("Threat service tests passed")
