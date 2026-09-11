import assert from "node:assert/strict"
import {
	addThrusterParts,
	getThrusterParts,
	loadThrusterParts,
	resetThrusterParts,
	spendThrusterParts,
} from "./thrusterPartService"

resetThrusterParts()
assert.equal(getThrusterParts(), 0)
assert.equal(addThrusterParts(2), 2)
assert.equal(getThrusterParts(), 2)
assert.equal(spendThrusterParts(1), true)
assert.equal(getThrusterParts(), 1)
assert.equal(spendThrusterParts(2), false)
assert.equal(getThrusterParts(), 1)
assert.equal(addThrusterParts(-3), 0)
assert.equal(getThrusterParts(), 1)
loadThrusterParts(4.4)
assert.equal(getThrusterParts(), 4)
resetThrusterParts()
assert.equal(getThrusterParts(), 0)
