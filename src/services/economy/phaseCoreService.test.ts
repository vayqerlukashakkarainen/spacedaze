import assert from "node:assert/strict"
import {
	addPhaseCores,
	beginPhaseCoreRun,
	getPhaseCores,
	getPhaseCoresEarnedThisRun,
	loadPhaseCores,
	resetPhaseCores,
	spendPhaseCores,
} from "./phaseCoreService"

resetPhaseCores()
assert.equal(getPhaseCores(), 0)

assert.equal(addPhaseCores(2), 2)
assert.equal(getPhaseCores(), 2)
assert(spendPhaseCores(1))
assert.equal(getPhaseCores(), 1)
assert.equal(spendPhaseCores(2), false)
assert.equal(getPhaseCores(), 1)

beginPhaseCoreRun()
addPhaseCores(1, true)
addPhaseCores(1)
assert.equal(getPhaseCores(), 3)
assert.equal(getPhaseCoresEarnedThisRun(), 1)

beginPhaseCoreRun()
assert.equal(getPhaseCoresEarnedThisRun(), 0)
assert.equal(getPhaseCores(), 3)

loadPhaseCores(4.4)
assert.equal(getPhaseCores(), 4)
assert.equal(getPhaseCoresEarnedThisRun(), 0)

console.log("Phase Core economy tests passed")
