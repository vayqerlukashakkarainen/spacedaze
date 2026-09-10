import assert from "node:assert/strict"
import {
	clampTurretWorldAngle,
	DRIFT_SPEED_MULTIPLIER,
	easeAngle,
	getMovementModeSpeedMultiplier,
	getPlayerTargetModeAimPosition,
	getSignedAngleDelta,
	isPlayerTargetModeActive,
	PLAYER_TURRET_LIMIT_DEGREES,
	setPlayerTargetModeAimPosition,
	setPlayerTargetModeActive,
	shouldTurnHullForStationaryAim,
} from "./playerSteeringModeService"
import { calculateInterceptTime } from "../player/targetInterceptService"

assert.equal(PLAYER_TURRET_LIMIT_DEGREES, 45)
assert.equal(DRIFT_SPEED_MULTIPLIER, 0.6)
assert.equal(getMovementModeSpeedMultiplier(1.15, 1, false), 1.15)
assert.equal(getMovementModeSpeedMultiplier(1.15, 1, true), 0.6)
assert.equal(getMovementModeSpeedMultiplier(1, 1.15, false), 1)
assert.equal(getMovementModeSpeedMultiplier(1, 1.15, true), 0.69)

setPlayerTargetModeActive(true)
assert.equal(isPlayerTargetModeActive(), true)
setPlayerTargetModeAimPosition({ x: 12, y: 34 })
assert.deepEqual(getPlayerTargetModeAimPosition(), { x: 12, y: 34 })
setPlayerTargetModeActive(false)
assert.equal(isPlayerTargetModeActive(), false)
assert.equal(getPlayerTargetModeAimPosition(), undefined)

assert.equal(getSignedAngleDelta(350, 10), 20)
assert.equal(getSignedAngleDelta(10, 350), -20)

assert.equal(clampTurretWorldAngle(0, 30), 30)
assert.equal(clampTurretWorldAngle(0, 90), 45)
assert.equal(clampTurretWorldAngle(0, -90), -45)
assert.equal(clampTurretWorldAngle(350, 50), 395)

assert.equal(shouldTurnHullForStationaryAim(0, 44, true), false)
assert.equal(shouldTurnHullForStationaryAim(0, 46, true), true)
assert.equal(shouldTurnHullForStationaryAim(0, 90, false), false)
assert.equal(shouldTurnHullForStationaryAim(350, 50, true), true)

const easedAcrossWrap = easeAngle(350, 10, 4, 0.25)
assert.ok(easedAcrossWrap > 350 && easedAcrossWrap < 370)
assert.ok(Math.abs(getSignedAngleDelta(easedAcrossWrap, 10)) < 20)

const crossingInterceptTime = calculateInterceptTime(
	{ x: 100, y: 0 },
	{ x: 0, y: 50 },
	100,
	2
)
assert.ok(Math.abs(crossingInterceptTime - 2 / Math.sqrt(3)) < 0.000001)
assert.equal(
	calculateInterceptTime(
		{ x: 1000, y: 0 },
		{ x: 0, y: 100 },
		200,
		0.75
	),
	0.75
)

console.log("Player steering mode tests passed")
