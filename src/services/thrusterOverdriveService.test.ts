import assert from "node:assert/strict"
import {
	createThrusterOverdriveState,
	THRUSTER_OVERDRIVE_DURATION_SECONDS,
	THRUSTER_OVERDRIVE_RECHARGE_SECONDS,
	updateThrusterOverdrive,
} from "./thrusterOverdriveService"

const state = createThrusterOverdriveState()

let update = updateThrusterOverdrive(
	state,
	true,
	THRUSTER_OVERDRIVE_DURATION_SECONDS / 2
)
assert.equal(update.active, true)
assert.equal(update.charge, 0.5)
assert.equal(update.overused, false)

update = updateThrusterOverdrive(
	state,
	false,
	THRUSTER_OVERDRIVE_RECHARGE_SECONDS / 4
)
assert.equal(update.charge, 0.75)
assert.equal(update.overused, false)

update = updateThrusterOverdrive(state, true, THRUSTER_OVERDRIVE_DURATION_SECONDS)
assert.equal(update.active, true)
assert.equal(update.charge, 0)
assert.equal(update.overused, true)

update = updateThrusterOverdrive(
	state,
	true,
	THRUSTER_OVERDRIVE_RECHARGE_SECONDS / 2
)
assert.equal(update.active, false)
assert.equal(update.charge, 0.5)
assert.equal(update.overused, true)

update = updateThrusterOverdrive(
	state,
	true,
	THRUSTER_OVERDRIVE_RECHARGE_SECONDS / 2
)
assert.equal(update.active, false)
assert.equal(update.charge, 1)
assert.equal(update.overused, false)

update = updateThrusterOverdrive(state, true, 0.1)
assert.equal(update.active, true)
assert.ok(update.charge < 1)

console.log("thruster overdrive service tests passed")
