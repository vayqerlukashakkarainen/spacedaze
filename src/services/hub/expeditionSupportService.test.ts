import assert from "node:assert/strict"
import {
	beginExpeditionSupportRun,
	consumeEmergencyNaniteShrine,
	getExpeditionSupportRank,
	getExpeditionSupportUpgradeCost,
	getExpeditionSupportValue,
	queueEmergencyNaniteShrine,
	resetExpeditionSupport,
	upgradeExpeditionSupport,
} from "./expeditionSupportService"

resetExpeditionSupport()
assert.equal(getExpeditionSupportRank("flightRecorder"), 0)
assert.equal(getExpeditionSupportValue("flightRecorder"), 0)
assert.equal(getExpeditionSupportUpgradeCost("flightRecorder"), 1)

assert.equal(upgradeExpeditionSupport("flightRecorder"), true)
assert.equal(getExpeditionSupportRank("flightRecorder"), 1)
assert.equal(getExpeditionSupportValue("flightRecorder"), 1)
assert.equal(getExpeditionSupportUpgradeCost("flightRecorder"), 2)

assert.equal(upgradeExpeditionSupport("flightRecorder"), true)
assert.equal(upgradeExpeditionSupport("flightRecorder"), true)
assert.equal(upgradeExpeditionSupport("flightRecorder"), false)
assert.equal(getExpeditionSupportValue("flightRecorder"), 3)
assert.equal(getExpeditionSupportUpgradeCost("flightRecorder"), undefined)

beginExpeditionSupportRun()
assert.equal(consumeEmergencyNaniteShrine(), 0)
assert.equal(queueEmergencyNaniteShrine(5), 5)
assert.equal(queueEmergencyNaniteShrine(3), 5)
assert.equal(consumeEmergencyNaniteShrine(), 5)
assert.equal(consumeEmergencyNaniteShrine(), 0)

resetExpeditionSupport()
console.log("expedition support service tests passed")
