import type { GameObj, PosComp, Vec2 } from "kaplay"
import {
	getTargetWorldPosition,
	isPlayerTargetable,
} from "../combat/targetingService"
import { calculateInterceptTime } from "./targetInterceptService"

export { calculateInterceptTime } from "./targetInterceptService"

let lockedTarget: GameObj<PosComp> | undefined
let targetMotion: TargetMotionState | undefined

const TARGET_VELOCITY_RESPONSE = 12
const MAX_TRACKED_TARGET_SPEED = 520
const MAX_INTERCEPT_TIME = 0.75

interface TargetMotionState {
	targetId: number
	lastPosition: Vec2
	velocity: Vec2
}

export function setPlayerTargetLock(target?: GameObj<PosComp>) {
	const nextTarget = target && isPlayerTargetable(target) ? target : undefined
	if (nextTarget?.id !== lockedTarget?.id) targetMotion = undefined
	lockedTarget = nextTarget
}

export function getPlayerTargetLock() {
	if (lockedTarget && isPlayerTargetable(lockedTarget)) return lockedTarget
	lockedTarget = undefined
	targetMotion = undefined
	return undefined
}

export function updatePlayerTargetMotion(
	target: GameObj<PosComp>,
	deltaSeconds: number
) {
	const targetPosition = getTargetWorldPosition(target)
	if (!targetMotion || targetMotion.targetId !== target.id) {
		targetMotion = {
			targetId: target.id,
			lastPosition: targetPosition,
			velocity: targetPosition.scale(0),
		}
		return targetMotion.velocity
	}
	if (deltaSeconds > 0.0001) {
		const sampledVelocity = targetPosition
			.sub(targetMotion.lastPosition)
			.scale(1 / deltaSeconds)
		const sampledSpeed = sampledVelocity.len()
		const boundedVelocity = sampledSpeed > MAX_TRACKED_TARGET_SPEED
			? sampledVelocity.unit().scale(MAX_TRACKED_TARGET_SPEED)
			: sampledVelocity
		const blend = 1 - Math.exp(-TARGET_VELOCITY_RESPONSE * deltaSeconds)
		targetMotion.velocity = targetMotion.velocity.lerp(boundedVelocity, blend)
	}
	targetMotion.lastPosition = targetPosition
	return targetMotion.velocity
}

export function getPlayerTargetInterceptPoint(
	shooterPosition: Vec2,
	target: GameObj<PosComp>,
	projectileSpeed: number
) {
	const targetPosition = getTargetWorldPosition(target)
	const velocity = targetMotion?.targetId === target.id
		? targetMotion.velocity
		: targetPosition.scale(0)
	const interceptTime = calculateInterceptTime(
		{
			x: targetPosition.x - shooterPosition.x,
			y: targetPosition.y - shooterPosition.y,
		},
		velocity,
		projectileSpeed,
		MAX_INTERCEPT_TIME
	)
	return targetPosition.add(velocity.scale(interceptTime))
}
