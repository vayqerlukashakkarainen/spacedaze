import assert from "node:assert/strict"
import {
	beginExtraLifeRun,
	consumeExtraLife,
	endExtraLifeRun,
	grantExtraLifeCharge,
	getExtraLifeSnapshot,
} from "./extraLifeService"

assert.deepEqual(beginExtraLifeRun(3), { remaining: 3, capacity: 3 })
assert.deepEqual(consumeExtraLife(), { remaining: 2, capacity: 3 })
assert.deepEqual(consumeExtraLife(), { remaining: 1, capacity: 3 })
assert.deepEqual(consumeExtraLife(), { remaining: 0, capacity: 3 })
assert.equal(consumeExtraLife(), undefined)

assert.deepEqual(beginExtraLifeRun(2), { remaining: 2, capacity: 2 })
assert.deepEqual(grantExtraLifeCharge(), { remaining: 3, capacity: 3 })
endExtraLifeRun()
assert.deepEqual(getExtraLifeSnapshot(), { remaining: 0, capacity: 0 })
assert.deepEqual(grantExtraLifeCharge(), { remaining: 0, capacity: 0 })

assert.deepEqual(beginExtraLifeRun(99), { remaining: 3, capacity: 3 })
assert.deepEqual(beginExtraLifeRun(Number.NaN), { remaining: 0, capacity: 0 })

console.log("extra life service tests passed")
