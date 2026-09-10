import assert from "node:assert/strict"
import type { Vec2 } from "kaplay"
import {
	type RocketGuidanceState,
	updateRocketGuidance,
} from "./rocketGuidanceService"

const stationary = updateRocketGuidance({
	rocketPosition: vec(0, 0),
	heading: vec(1, 0),
	targetId: 1,
	targetPosition: vec(100, 0),
	rocketSpeed: 280,
	baseTurnStrength: 0.065,
	deltaTime: 1 / 60,
})
assert.deepEqual(point(stationary.aimPosition), [100, 0])
assert.equal(stationary.speedMultiplier, 1)

const movingState: RocketGuidanceState = {
	targetId: 2,
	lastTargetPosition: vec(120, -2),
	targetVelocity: vec(0, 0),
	closestDistance: 121,
	recovering: false,
}
const moving = updateRocketGuidance({
	rocketPosition: vec(0, 0),
	heading: vec(1, 0),
	targetId: 2,
	targetPosition: vec(120, 0),
	rocketSpeed: 280,
	baseTurnStrength: 0.065,
	deltaTime: 1 / 60,
}, movingState)
assert.ok(moving.aimPosition.y > 0, "Rocket should lead a moving target")

const overshootState: RocketGuidanceState = {
	targetId: 3,
	lastTargetPosition: vec(0, 0),
	targetVelocity: vec(0, 0),
	closestDistance: 24,
	recovering: false,
}
const recovering = updateRocketGuidance({
	rocketPosition: vec(42, 0),
	heading: vec(1, 0),
	targetId: 3,
	targetPosition: vec(0, 0),
	rocketSpeed: 280,
	baseTurnStrength: 0.065,
	deltaTime: 1 / 60,
}, overshootState)
assert.equal(recovering.state.recovering, true)
assert.equal(recovering.turnStrength, 0.36)
assert.equal(recovering.speedMultiplier, 0.48)
assert.deepEqual(point(recovering.aimPosition), [0, 0])

const realigned = updateRocketGuidance({
	rocketPosition: vec(42, 0),
	heading: vec(-1, 0),
	targetId: 3,
	targetPosition: vec(0, 0),
	rocketSpeed: 280,
	baseTurnStrength: 0.065,
	deltaTime: 1 / 60,
}, recovering.state)
assert.equal(realigned.state.recovering, false)
assert.equal(realigned.state.closestDistance, 42)

assert.equal(
	simulateIntercept(vec(-85, 0), vec(0, -1), vec(0, 0), vec(0, 0)),
	true,
	"A close perpendicular approach should recover instead of orbiting"
)
assert.equal(
	simulateIntercept(vec(-180, 50), vec(1, 0), vec(0, 0), vec(0, 55)),
	true,
	"A rocket should intercept a laterally moving target"
)

console.log("Rocket guidance tests passed")

function simulateIntercept(
	startPosition: Vec2,
	startHeading: Vec2,
	startTargetPosition: Vec2,
	targetVelocity: Vec2
) {
	const deltaTime = 1 / 60
	let rocketPosition = startPosition
	let heading = startHeading
	let targetPosition = startTargetPosition
	let state: RocketGuidanceState | undefined
	for (let frame = 0; frame < 60 * 6; frame++) {
		if (rocketPosition.dist(targetPosition) <= 12) return true
		const guidance = updateRocketGuidance({
			rocketPosition,
			heading,
			targetId: 10,
			targetPosition,
			rocketSpeed: 280,
			baseTurnStrength: 0.065,
			deltaTime,
		}, state)
		state = guidance.state
		heading = turnToward(
			heading,
			guidance.aimPosition.sub(rocketPosition),
			guidance.turnStrength
		)
		rocketPosition = rocketPosition.add(
			heading.scale(280 * guidance.speedMultiplier * deltaTime)
		)
		targetPosition = targetPosition.add(targetVelocity.scale(deltaTime))
	}
	return false
}

function turnToward(current: Vec2, desired: Vec2, strength: number) {
	const currentAngle = Math.atan2(current.y, current.x)
	const desiredAngle = Math.atan2(desired.y, desired.x)
	const angleDelta = Math.atan2(
		Math.sin(desiredAngle - currentAngle),
		Math.cos(desiredAngle - currentAngle)
	)
	const angle = currentAngle + angleDelta * strength
	return vec(Math.cos(angle), Math.sin(angle))
}

function vec(x: number, y: number): Vec2 {
	return {
		x,
		y,
		clone: () => vec(x, y),
		add: (other: Vec2) => vec(x + other.x, y + other.y),
		sub: (other: Vec2) => vec(x - other.x, y - other.y),
		scale: (amount: number) => vec(x * amount, y * amount),
		lerp: (other: Vec2, amount: number) => vec(
			x + (other.x - x) * amount,
			y + (other.y - y) * amount
		),
		len: () => Math.hypot(x, y),
		dist: (other: Vec2) => Math.hypot(other.x - x, other.y - y),
		unit: () => {
			const length = Math.hypot(x, y)
			return length > 0 ? vec(x / length, y / length) : vec(0, 0)
		},
		dot: (other: Vec2) => x * other.x + y * other.y,
	} as Vec2
}

function point(value: Vec2) {
	return [value.x, value.y]
}
