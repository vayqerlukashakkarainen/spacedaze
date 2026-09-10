export const PLAYER_TURRET_LIMIT_DEGREES = 45
export const DRIFT_SPEED_MULTIPLIER = 0.6
export const DRIFT_HULL_RESPONSE = 2.5
export const TURRET_AIM_RESPONSE = 9

export function getMovementModeSpeedMultiplier(
	normalSpeedMultiplier: number,
	strafeSpeedMultiplier: number,
	strafeModeActive: boolean
) {
	return strafeModeActive
		? strafeSpeedMultiplier * DRIFT_SPEED_MULTIPLIER
		: normalSpeedMultiplier
}

let playerTargetModeActive = false
let playerTargetModeAimPosition: { x: number; y: number } | undefined

export function setPlayerTargetModeActive(active: boolean) {
	playerTargetModeActive = active
	if (!active) playerTargetModeAimPosition = undefined
}

export function isPlayerTargetModeActive() {
	return playerTargetModeActive
}

export function setPlayerTargetModeAimPosition(
	position?: { x: number; y: number }
) {
	playerTargetModeAimPosition = position
		? { x: position.x, y: position.y }
		: undefined
}

export function getPlayerTargetModeAimPosition() {
	return playerTargetModeAimPosition
		? { ...playerTargetModeAimPosition }
		: undefined
}

export function getSignedAngleDelta(fromAngle: number, toAngle: number) {
	return ((toAngle - fromAngle + 540) % 360) - 180
}

export function clampTurretWorldAngle(
	hullAngle: number,
	desiredTurretAngle: number,
	limitDegrees: number = PLAYER_TURRET_LIMIT_DEGREES
) {
	const offset = getSignedAngleDelta(hullAngle, desiredTurretAngle)
	return hullAngle + clamp(offset, -limitDegrees, limitDegrees)
}

export function shouldTurnHullForStationaryAim(
	hullAngle: number,
	desiredTurretAngle: number,
	isStationary: boolean,
	limitDegrees: number = PLAYER_TURRET_LIMIT_DEGREES
) {
	return isStationary &&
		Math.abs(getSignedAngleDelta(hullAngle, desiredTurretAngle)) > limitDegrees
}

export function easeAngle(
	currentAngle: number,
	targetAngle: number,
	response: number,
	deltaSeconds: number
) {
	const blend = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds))
	return currentAngle + getSignedAngleDelta(currentAngle, targetAngle) * blend
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value))
}
