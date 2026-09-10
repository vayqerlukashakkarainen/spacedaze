import assert from "node:assert/strict"
import {
	consumeUltimateCharge,
	getUltimateCharge,
	getUltimateChargeProgress,
	grantUltimateCharge,
	resetUltimateCharge,
} from "./ultimateAbilityService"

resetUltimateCharge()
assert.equal(getUltimateCharge(), 0)
assert.equal(getUltimateChargeProgress(), 0)
assert.equal(consumeUltimateCharge(), false)

grantUltimateCharge(35)
assert.equal(getUltimateCharge(), 35)
assert.equal(getUltimateChargeProgress(), 0.35)

grantUltimateCharge(1000)
assert.equal(getUltimateCharge(), 100)
assert.equal(getUltimateChargeProgress(), 1)
assert.equal(consumeUltimateCharge(), true)
assert.equal(getUltimateCharge(), 0)

grantUltimateCharge(-5)
grantUltimateCharge(Number.NaN)
assert.equal(getUltimateCharge(), 0)

console.log("Ultimate ability service tests passed")
