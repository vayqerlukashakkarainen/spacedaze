import assert from "node:assert/strict"
import {
	activateDroneFrenzy,
	DRONE_FRENZY_DAMAGE_MULTIPLIER,
	DRONE_FRENZY_DURATION_SECONDS,
	DRONE_FRENZY_FIRE_RATE_MULTIPLIER,
	getDroneFrenzyDamageMultiplier,
	getDroneFrenzyFireRateMultiplier,
	getDroneFrenzyRemainingSeconds,
	isDroneFrenzyActive,
	resetDroneFrenzy,
	updateDroneFrenzy,
} from "./droneFrenzyService"

resetDroneFrenzy()
assert.equal(isDroneFrenzyActive(), false)

activateDroneFrenzy()
assert.equal(isDroneFrenzyActive(), true)
assert.equal(getDroneFrenzyRemainingSeconds(), DRONE_FRENZY_DURATION_SECONDS)
assert.equal(getDroneFrenzyDamageMultiplier(), DRONE_FRENZY_DAMAGE_MULTIPLIER)
assert.equal(getDroneFrenzyFireRateMultiplier(), DRONE_FRENZY_FIRE_RATE_MULTIPLIER)

updateDroneFrenzy(2)
assert.equal(getDroneFrenzyRemainingSeconds(), 3)
assert.equal(isDroneFrenzyActive(), true)

updateDroneFrenzy(3)
assert.equal(isDroneFrenzyActive(), false)
assert.equal(getDroneFrenzyDamageMultiplier(), 1)
assert.equal(getDroneFrenzyFireRateMultiplier(), 1)

activateDroneFrenzy({
	duration: 6,
	damageMultiplier: 1.8,
	fireRateMultiplier: 2.1,
})
assert.equal(getDroneFrenzyRemainingSeconds(), 6)
assert.equal(getDroneFrenzyDamageMultiplier(), 1.8)
assert.equal(getDroneFrenzyFireRateMultiplier(), 2.1)

resetDroneFrenzy()

console.log("Drone frenzy service tests passed")
