import assert from "node:assert/strict"
import {
	clampTurretWorldAngle,
	DRIFT_SPEED_MULTIPLIER,
	easeAngle,
	getSignedAngleDelta,
	PLAYER_TURRET_LIMIT_DEGREES,
} from "./playerSteeringModeService"

assert.equal(PLAYER_TURRET_LIMIT_DEGREES, 45)
assert.equal(DRIFT_SPEED_MULTIPLIER, 0.6)

assert.equal(getSignedAngleDelta(350, 10), 20)
assert.equal(getSignedAngleDelta(10, 350), -20)

assert.equal(clampTurretWorldAngle(0, 30), 30)
assert.equal(clampTurretWorldAngle(0, 90), 45)
assert.equal(clampTurretWorldAngle(0, -90), -45)
assert.equal(clampTurretWorldAngle(350, 50), 395)

const easedAcrossWrap = easeAngle(350, 10, 4, 0.25)
assert.ok(easedAcrossWrap > 350 && easedAcrossWrap < 370)
assert.ok(Math.abs(getSignedAngleDelta(easedAcrossWrap, 10)) < 20)

console.log("Player steering mode tests passed")
