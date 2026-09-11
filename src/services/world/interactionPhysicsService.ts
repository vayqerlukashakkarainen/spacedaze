import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { incrementPerformanceCounter } from "../debug/frameProfilerService"

const DEFAULT_PUSHER_RADIUS = 9
const DEFAULT_MASS = 1
const DEFAULT_MAX_SPEED = 150
const DEFAULT_PUSH_TRANSFER = 0.9
const DEFAULT_SEPARATION_RESPONSE = 14
const MAX_TRACKED_FRAME_TIME = 1 / 20

interface PushablePhysicsBody extends GameObj {
	snareVelocity: Vec2
	snareAngularVelocity?: number
	snared?: boolean
}

interface RegisteredInteractionBody {
	target: PushablePhysicsBody
	options: PushableInteractionPhysicsOptions
}

const registeredInteractionBodies = new Map<number, RegisteredInteractionBody>()

export interface PushableInteractionPhysicsOptions {
	radius: number
	getPusher?: () => GameObj | undefined
	getPushers?: () => readonly GameObj[]
	forEachPusher?: (visitor: (pusher: GameObj) => void) => void
	pusherRadius?: number
	getPusherRadius?: (pusher: GameObj) => number
	mass?: number
	maxSpeed?: number
	pushTransfer?: number
	separationResponse?: number
	canPush?: (target: GameObj, pusher: GameObj) => boolean
}

export function registerPushableInteractionPhysics(
	target: PushablePhysicsBody,
	options: PushableInteractionPhysicsOptions
) {
	target.tag(tags.pushable)
	registeredInteractionBodies.set(target.id, { target, options })
	target.onDestroy(() => registeredInteractionBodies.delete(target.id))
	const previousPusherPositions = new Map<number, {
		pusher: GameObj
		position: Vec2
	}>()
	let framesUntilPositionCleanup = 120

	return registerBatchedEntityUpdate("world", target, () => {
		framesUntilPositionCleanup--
		if (framesUntilPositionCleanup <= 0) {
			framesUntilPositionCleanup = 120
			for (const [id, tracked] of previousPusherPositions) {
				if (tracked.pusher.exists()) continue
				previousPusherPositions.delete(id)
			}
		}

		const primaryPusher = options.getPusher?.()
		if (primaryPusher) applyPusherContact(primaryPusher)
		const visitPusher = (pusher: GameObj) => {
			if (pusher.id === primaryPusher?.id) return
			applyPusherContact(pusher)
		}
		if (options.forEachPusher) {
			options.forEachPusher(visitPusher)
		} else {
			for (const pusher of options.getPushers?.() ?? []) visitPusher(pusher)
		}

		function applyPusherContact(pusher: GameObj) {
			if (!pusher.exists() || !pusher.pos || pusher.id === target.id) return
			const registeredPusher = registeredInteractionBodies.get(pusher.id)
			const targetCanPush = !target.snared &&
				options.canPush?.(target, pusher) !== false
			const pusherCanPush = registeredPusher &&
				!registeredPusher.target.snared &&
				registeredPusher.options.canPush?.(
					registeredPusher.target,
					target
				) !== false
			const resolvePair = registeredPusher &&
				!pusher.paused &&
				targetCanPush &&
				pusherCanPush
			if (!targetCanPush) return
			if (resolvePair && target.id > pusher.id) return
			const pusherVelocity = resolvePair
				? registeredPusher.target.snareVelocity.clone()
				: trackPusherVelocity(pusher)
			if (!pusherVelocity) return
			const targetVelocity = target.snareVelocity.clone()
			incrementPerformanceCounter("physicsPairChecks")
			if (applyContactPush(
				target,
				pusher.pos,
				pusherVelocity,
				options,
				options.getPusherRadius?.(pusher)
			)) incrementPerformanceCounter("physicsContacts")
			if (!resolvePair) return
			if (applyContactPush(
				registeredPusher.target,
				target.pos,
				targetVelocity,
				registeredPusher.options,
				registeredPusher.options.getPusherRadius?.(target)
			)) incrementPerformanceCounter("physicsContacts")
		}

		function trackPusherVelocity(pusher: GameObj) {
			const previous = previousPusherPositions.get(pusher.id)
			previousPusherPositions.set(pusher.id, {
				pusher,
				position: pusher.pos.clone(),
			})
			if (!previous) return undefined
			const deltaSeconds = Math.min(k.dt(), MAX_TRACKED_FRAME_TIME)
			return deltaSeconds > 0
				? pusher.pos.sub(previous.position).scale(1 / deltaSeconds)
				: k.vec2(0)
		}
	})
}

function applyContactPush(
	target: PushablePhysicsBody,
	pusherPosition: Vec2,
	pusherVelocity: Vec2,
	options: PushableInteractionPhysicsOptions,
	pusherRadius?: number
) {
	const radius = Math.max(1, options.radius)
	const contactDistance = radius + Math.max(
		1,
		pusherRadius ?? options.pusherRadius ?? DEFAULT_PUSHER_RADIUS
	)
	const offset = target.pos.sub(pusherPosition)
	const distance = offset.len()
	if (distance >= contactDistance) return false

	const direction = distance > 0.001
		? offset.scale(1 / distance)
		: pusherVelocity.len() > 0.001
			? pusherVelocity.unit()
			: k.Vec2.fromAngle(target.id % 360)
	const overlap = contactDistance - distance
	const approachSpeed = Math.max(0, pusherVelocity.dot(direction))
	const mass = Math.max(0.1, options.mass ?? DEFAULT_MASS)
	const desiredOutwardSpeed = Math.min(
		Math.max(1, options.maxSpeed ?? DEFAULT_MAX_SPEED),
		(
			approachSpeed * (options.pushTransfer ?? DEFAULT_PUSH_TRANSFER) +
			overlap * (options.separationResponse ?? DEFAULT_SEPARATION_RESPONSE)
		) / mass
	)
	const currentOutwardSpeed = target.snareVelocity.dot(direction)
	const addedSpeed = desiredOutwardSpeed - currentOutwardSpeed
	if (addedSpeed <= 0.001) return false

	target.snareVelocity = target.snareVelocity.add(
		direction.scale(addedSpeed)
	)
	const maxSpeed = Math.max(1, options.maxSpeed ?? DEFAULT_MAX_SPEED)
	if (target.snareVelocity.len() > maxSpeed) {
		target.snareVelocity = target.snareVelocity.unit().scale(maxSpeed)
	}

	if (typeof target.snareAngularVelocity !== "number") return true
	const tangent = k.vec2(-direction.y, direction.x)
	const tangentialSpeed = pusherVelocity.dot(tangent)
	target.snareAngularVelocity = k.clamp(
		target.snareAngularVelocity + tangentialSpeed / radius * 18,
		-360,
		360
	)
	return true
}
