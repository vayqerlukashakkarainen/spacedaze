import type { GameObj, PosComp, Vec2 } from "kaplay"

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
	const nextTarget = target?.exists() ? target : undefined
	if (nextTarget?.id !== lockedTarget?.id) targetMotion = undefined
	lockedTarget = nextTarget
}

export function getPlayerTargetLock() {
	if (lockedTarget?.exists()) return lockedTarget
	lockedTarget = undefined
	targetMotion = undefined
	return undefined
}

export function updatePlayerTargetMotion(
	target: GameObj<PosComp>,
	deltaSeconds: number
) {
	if (!targetMotion || targetMotion.targetId !== target.id) {
		targetMotion = {
			targetId: target.id,
			lastPosition: target.pos.clone(),
			velocity: target.pos.scale(0),
		}
		return targetMotion.velocity
	}
	if (deltaSeconds > 0.0001) {
		const sampledVelocity = target.pos
			.sub(targetMotion.lastPosition)
			.scale(1 / deltaSeconds)
		const sampledSpeed = sampledVelocity.len()
		const boundedVelocity = sampledSpeed > MAX_TRACKED_TARGET_SPEED
			? sampledVelocity.unit().scale(MAX_TRACKED_TARGET_SPEED)
			: sampledVelocity
		const blend = 1 - Math.exp(-TARGET_VELOCITY_RESPONSE * deltaSeconds)
		targetMotion.velocity = targetMotion.velocity.lerp(boundedVelocity, blend)
	}
	targetMotion.lastPosition = target.pos.clone()
	return targetMotion.velocity
}

export function getPlayerTargetInterceptPoint(
	shooterPosition: Vec2,
	target: GameObj<PosComp>,
	projectileSpeed: number
) {
	const velocity = targetMotion?.targetId === target.id
		? targetMotion.velocity
		: target.pos.scale(0)
	const interceptTime = calculateInterceptTime(
		{
			x: target.pos.x - shooterPosition.x,
			y: target.pos.y - shooterPosition.y,
		},
		velocity,
		projectileSpeed,
		MAX_INTERCEPT_TIME
	)
	return target.pos.add(velocity.scale(interceptTime))
}

export function calculateInterceptTime(
	relativePosition: { x: number; y: number },
	targetVelocity: { x: number; y: number },
	projectileSpeed: number,
	maxInterceptTime: number = MAX_INTERCEPT_TIME
) {
	if (projectileSpeed <= 0) return 0
	const speedSquared = projectileSpeed * projectileSpeed
	const velocitySquared =
		targetVelocity.x * targetVelocity.x +
		targetVelocity.y * targetVelocity.y
	const a = velocitySquared - speedSquared
	const b = 2 * (
		relativePosition.x * targetVelocity.x +
		relativePosition.y * targetVelocity.y
	)
	const c =
		relativePosition.x * relativePosition.x +
		relativePosition.y * relativePosition.y
	let interceptTime: number | undefined

	if (Math.abs(a) < 0.0001) {
		if (Math.abs(b) > 0.0001) {
			const linearTime = -c / b
			if (linearTime > 0) interceptTime = linearTime
		}
	} else {
		const discriminant = b * b - 4 * a * c
		if (discriminant >= 0) {
			const root = Math.sqrt(discriminant)
			const firstTime = (-b - root) / (2 * a)
			const secondTime = (-b + root) / (2 * a)
			const positiveTimes = [firstTime, secondTime]
				.filter((time) => time > 0)
			interceptTime = positiveTimes.length > 0
				? Math.min(...positiveTimes)
				: undefined
		}
	}

	if (interceptTime === undefined) {
		interceptTime = Math.sqrt(c) / projectileSpeed
	}
	return Math.min(maxInterceptTime, Math.max(0, interceptTime))
}
