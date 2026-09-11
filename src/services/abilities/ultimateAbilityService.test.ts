import assert from "node:assert/strict"
import {
	consumeUltimateCharge,
	getUltimateCharge,
	getUltimateChargeProgress,
	grantUltimateCharge,
	grantUltimateChargeForDestruction,
	grantUltimateChargeForHit,
	onUltimateChargeGranted,
	resetUltimateCharge,
} from "./ultimateAbilityService"
import {
	equipAbility,
	resetAbilityLoadout,
} from "./abilityLoadoutService"

resetAbilityLoadout()
resetUltimateCharge()
assert.equal(getUltimateCharge(), 0)
assert.equal(getUltimateChargeProgress(), 0)
assert.equal(consumeUltimateCharge(), false)

grantUltimateCharge(35)
assert.equal(getUltimateCharge(), 0)

equipAbility("ultimate", "phaseNova")
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

grantUltimateChargeForDestruction("trainingTarget")
assert.equal(getUltimateCharge(), 7)
grantUltimateChargeForDestruction("environment")
assert.equal(getUltimateCharge(), 11)

grantUltimateChargeForHit({ kind: "primary", id: "blaster" })
assert.equal(getUltimateCharge(), 12)
grantUltimateChargeForHit({
	kind: "primary",
	id: "pulseRepeater",
	ultimateCharge: 0.1,
})
assert.equal(getUltimateCharge(), 12.1)
grantUltimateChargeForHit({ kind: "secondary", id: "rocketPod" })
assert.equal(getUltimateCharge(), 13.1)
grantUltimateChargeForHit({ kind: "ultimate", id: "ghostFleet" })
grantUltimateChargeForHit({ kind: "environment", id: "proximityMine" })
grantUltimateChargeForHit(undefined)
assert.equal(getUltimateCharge(), 13.1)

resetUltimateCharge()
const gainEvents: Array<{ amount: number; becameReady: boolean }> = []
const listener = onUltimateChargeGranted((event) => {
	gainEvents.push({ amount: event.amount, becameReady: event.becameReady })
})
grantUltimateCharge(75)
grantUltimateCharge(50)
grantUltimateCharge(10)
listener.cancel()
assert.deepEqual(gainEvents, [
	{ amount: 75, becameReady: false },
	{ amount: 25, becameReady: true },
])
resetAbilityLoadout()

console.log("Ultimate ability service tests passed")
