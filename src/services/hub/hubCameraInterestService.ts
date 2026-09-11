import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k } from "../../main"

interface HubCameraInterestOptions {
	radius?: number
	strength?: number
	priority?: number
	isActive?: () => boolean
}

interface HubCameraInterestPoint {
	id: number
	owner: GameObj<PosComp>
	radius: number
	strength: number
	priority: number
	isActive?: () => boolean
}

const DEFAULT_RADIUS = 340
const DEFAULT_STRENGTH = 0.3
const MAX_CAMERA_PULL_DISTANCE = 92
const CAMERA_INTEREST_RESPONSE = 4.5

const interestPoints = new Map<number, HubCameraInterestPoint>()
let nextInterestId = 1
let currentCameraPull: Vec2 | undefined

export function registerHubCameraInterest(
	owner: GameObj<PosComp>,
	options: HubCameraInterestOptions = {}
) {
	const id = nextInterestId++
	let registered = true
	const unregister = () => {
		if (!registered) return
		registered = false
		interestPoints.delete(id)
		if (interestPoints.size === 0) currentCameraPull = undefined
	}
	interestPoints.set(id, {
		id,
		owner,
		radius: Math.max(1, options.radius ?? DEFAULT_RADIUS),
		strength: k.clamp(options.strength ?? DEFAULT_STRENGTH, 0, 1),
		priority: Math.max(0, options.priority ?? 1),
		isActive: options.isActive,
	})
	owner.onDestroy(unregister)
	return unregister
}

export function applyHubCameraInterest(
	baseTarget: Vec2,
	playerPos: Vec2
) {
	if (interestPoints.size === 0) {
		currentCameraPull = undefined
		return baseTarget
	}
	let desiredPull = k.vec2()
	let totalInfluence = 0

	for (const point of interestPoints.values()) {
		if (!point.owner.exists() || point.isActive?.() === false) continue
		const distance = playerPos.dist(point.owner.pos)
		if (distance >= point.radius) continue
		const proximity = 1 - distance / point.radius
		const easedProximity = proximity * proximity * (3 - 2 * proximity)
		const influence = easedProximity * point.strength * point.priority
		desiredPull = desiredPull.add(
			point.owner.pos.sub(baseTarget).scale(influence)
		)
		totalInfluence += influence
	}

	if (totalInfluence > 1) desiredPull = desiredPull.scale(1 / totalInfluence)
	const desiredDistance = desiredPull.len()
	if (desiredDistance > MAX_CAMERA_PULL_DISTANCE) {
		desiredPull = desiredPull.unit().scale(MAX_CAMERA_PULL_DISTANCE)
	}

	if (!currentCameraPull) currentCameraPull = k.vec2()
	const blend = 1 - Math.exp(-CAMERA_INTEREST_RESPONSE * k.dt())
	currentCameraPull = currentCameraPull.lerp(desiredPull, blend)
	if (currentCameraPull.len() < 0.01 && desiredDistance === 0) {
		currentCameraPull = k.vec2()
	}
	return baseTarget.add(currentCameraPull)
}
