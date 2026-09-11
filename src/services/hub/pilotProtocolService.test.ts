import assert from "node:assert/strict"
import {
	equipPilotProtocol,
	getActivePilotProtocol,
	getPilotProtocolRank,
	getPilotProtocolUpgradeCost,
	getPilotProtocolValue,
	resetPilotProtocols,
	upgradePilotProtocol,
} from "./pilotProtocolService"

resetPilotProtocols()
assert.equal(getPilotProtocolRank("signalDecoder"), 0)
assert.equal(getPilotProtocolValue("signalDecoder"), 0)
assert.equal(getPilotProtocolUpgradeCost("signalDecoder"), 80)

assert.equal(upgradePilotProtocol("signalDecoder"), true)
assert.equal(getPilotProtocolRank("signalDecoder"), 1)
assert.equal(getActivePilotProtocol("navigation"), "signalDecoder")
assert.equal(getPilotProtocolValue("signalDecoder"), 1)

assert.equal(upgradePilotProtocol("threatAnalyzer"), true)
assert.equal(getActivePilotProtocol("navigation"), "threatAnalyzer")
assert.equal(getPilotProtocolValue("signalDecoder"), 0)
assert.equal(getPilotProtocolValue("threatAnalyzer"), 1)
assert.equal(equipPilotProtocol("signalDecoder"), true)
assert.equal(getActivePilotProtocol("navigation"), "signalDecoder")

resetPilotProtocols()
console.log("Pilot protocol service tests passed")
