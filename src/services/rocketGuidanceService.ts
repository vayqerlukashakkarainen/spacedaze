import type { Vec2 } from "kaplay"

const MAX_TARGET_SPEED = 520
const MAX_INTERCEPT_TIME = 0.45
const INTERCEPT_STRENGTH = 0.62
const VELOCITY_RESPONSE = 12
const RECOVERY_DISTANCE = 130
const RECOVERY_ALIGNMENT = 0.28
const RECOVERY_EXIT_ALIGNMENT = 0.82
const OVERSHOOT_MARGIN = 10
const RECOVERY_TURN_STRENGTH = 0.36
const RECOVERY_SPEED_MULTIPLIER = 0.48

export interface RocketGuidanceState {
	targetId: number
	lastTargetPosition: Vec2
	targetVelocity: Vec2
	closestDistance: number
	recovering: boolean
}

export interface RocketGuidanceInput {
	rocketPosition: Vec2
	heading: Vec2
	targetId: number
	targetPosition: Vec2
	rocketSpeed: number
	baseTurnStrength: number
	deltaTime: number
}

export interface RocketGuidanceResult {
	aimPosition: Vec2
	turnStrength: number
	speedMultiplier: number
	state: RocketGuidanceState
}

export function updateRocketGuidance(
	input: RocketGuidanceInput,
	previousState?: RocketGuidanceState
): RocketGuidanceResult {
	const distance = input.rocketPosition.dist(input.targetPosition)
	const targetChanged = previousState?.targetId !== input.targetId
	const state: RocketGuidanceState = targetChanged || !previousState
		? {
			targetId: input.targetId,
			lastTargetPosition: input.targetPosition.clone(),
			targetVelocity: input.targetPosition.scale(0),
			closestDistance: distance,
			recovering: false,
		}
		: previousState

	if (!targetChanged && input.deltaTime > 0.0001) {
		const sampledVelocity = input.targetPosition
			.sub(state.lastTargetPosition)
			.scale(1 / input.deltaTime)
		const sampledSpeed = sampledVelocity.len()
		const boundedVelocity = sampledSpeed > MAX_TARGET_SPEED
			? sampledVelocity.unit().scale(MAX_TARGET_SPEED)
			: sampledVelocity
		const velocityBlend = 1 - Math.exp(-VELOCITY_RESPONSE * input.deltaTime)
		state.targetVelocity = state.targetVelocity.lerp(
			boundedVelocity,
			velocityBlend
		)
	}
	state.lastTargetPosition = input.targetPosition.clone()

	const directDirection = input.targetPosition.sub(input.rocketPosition)
	const normalizedDirection = directDirection.len() > 0.001
		? directDirection.unit()
		: input.heading
	const normalizedHeading = input.heading.len() > 0.001
		? input.heading.unit()
		: normalizedDirection
	const alignment = normalizedHeading.dot(normalizedDirection)
	const overshot = distance > state.closestDistance + OVERSHOOT_MARGIN &&
		state.closestDistance < RECOVERY_DISTANCE
	state.closestDistance = Math.min(state.closestDistance, distance)

	if (
		!state.recovering &&
		(
			overshot ||
			(distance < RECOVERY_DISTANCE && alignment < RECOVERY_ALIGNMENT)
		)
	) {
		state.recovering = true
	}
	if (state.recovering && alignment >= RECOVERY_EXIT_ALIGNMENT) {
		state.recovering = false
		state.closestDistance = distance
	}

	const closeFactor = clamp01(1 - distance / RECOVERY_DISTANCE)
	const alignmentTurnBoost = clamp01((0.65 - alignment) / 1.65) * 0.1
	const turnStrength = state.recovering
		? Math.max(input.baseTurnStrength, RECOVERY_TURN_STRENGTH)
		: Math.min(
			0.24,
			input.baseTurnStrength + closeFactor * 0.14 + alignmentTurnBoost
		)
	const speedMultiplier = state.recovering
		? RECOVERY_SPEED_MULTIPLIER
		: 1 - closeFactor * clamp01((0.55 - alignment) / 1.55) * 0.28
	const interceptTime = state.recovering
		? 0
		: Math.min(
			MAX_INTERCEPT_TIME,
			(distance / Math.max(1, input.rocketSpeed)) * INTERCEPT_STRENGTH
		)

	return {
		aimPosition: input.targetPosition.add(
			state.targetVelocity.scale(interceptTime)
		),
		turnStrength,
		speedMultiplier,
		state,
	}
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value))
}
