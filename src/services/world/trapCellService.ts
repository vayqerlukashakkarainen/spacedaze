import type { GameObj, KEventController, Vec2 } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"
import { findSegmentCircleIntersection } from "../combat/projectileCollisionService"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import {
	getMaxProjectileSweepDistance,
	querySpatialNearby,
} from "../core/runtimeSpatialIndexService"

const TRAP_TARGET_TAGS = [
	tags.player,
	tags.unit,
	tags.projectile,
	tags.debree,
	tags.props,
]
const SLOWDOWN_TRAP_MODIFIER_ID = -84_013

export type TrapCellTarget = GameObj & {
	previousPos?: Vec2
	dir?: Vec2
	speed?: number
	lifeSpan?: number
	moveDirection?: Vec2
	timescaleModifiers?: Map<number, number>
	snareMass?: number
	releaseSnare?: (velocity?: Vec2) => void
}

interface TrapCellTriggerOptions {
	owner: GameObj
	position: Vec2
	triggerRadius: number
	cooldownSeconds: number
	activationFlashSeconds: number
	onTriggered: (target: TrapCellTarget) => void
}

export interface TrapCellTriggerController {
	cooldownRemaining(): number
	activationFlashRemaining(): number
}

interface SlowdownState {
	remaining: number
	originalSpeed?: number
	controller?: KEventController
}

const slowdownStates = new WeakMap<GameObj, SlowdownState>()

export function registerTrapCellTrigger(
	options: TrapCellTriggerOptions
): TrapCellTriggerController {
	let cooldown = 0
	let activationFlash = 0
	let objectsInside = new Set<number>()
	const previousPositions = new Map<number, Vec2>()

	registerBatchedEntityUpdate("world", options.owner, () => {
		cooldown = Math.max(0, cooldown - k.dt())
		activationFlash = Math.max(0, activationFlash - k.dt())
		const nextObjectsInside = new Set<number>()
		const candidates = queryTrapTargets(
			options.position,
			options.triggerRadius + getMaxProjectileSweepDistance()
		)

		for (const candidate of candidates) {
			const inside = candidate.pos.dist(options.position) <= options.triggerRadius
			if (inside) nextObjectsInside.add(candidate.id)
			const previousPosition = candidate.previousPos ??
				previousPositions.get(candidate.id)
			const crossedTrap = inside || previousPosition !== undefined &&
				findSegmentCircleIntersection(
					previousPosition,
					candidate.pos,
					options.position,
					options.triggerRadius
				) !== undefined
			previousPositions.set(candidate.id, candidate.pos.clone())
			if (
				cooldown > 0 ||
				objectsInside.has(candidate.id) ||
				!crossedTrap
			) continue
			options.onTriggered(candidate)
			cooldown = options.cooldownSeconds
			activationFlash = options.activationFlashSeconds
			break
		}

		objectsInside = nextObjectsInside
	})

	return {
		cooldownRemaining: () => cooldown,
		activationFlashRemaining: () => activationFlash,
	}
}

export function queryTrapTargets(position: Vec2, radius: number) {
	return (querySpatialNearby(position, radius, {
		anyTags: TRAP_TARGET_TAGS,
	}) as TrapCellTarget[]).filter(isTrapCellTarget)
}

export function applySlowdownTrapEffect(
	target: TrapCellTarget,
	multiplier: number,
	duration: number
) {
	if (!target.exists() || duration <= 0) return
	const slowdownMultiplier = k.clamp(multiplier, 0.05, 1)
	const activeState = slowdownStates.get(target)
	if (activeState) {
		activeState.remaining = Math.max(activeState.remaining, duration)
		return
	}

	const hasTimescale = target.timescaleModifiers instanceof Map
	const originalSpeed = !hasTimescale && typeof target.speed === "number"
		? target.speed
		: undefined
	if (hasTimescale) {
		target.timescaleModifiers!.set(
			SLOWDOWN_TRAP_MODIFIER_ID,
			slowdownMultiplier
		)
	} else if (originalSpeed !== undefined) {
		target.speed = originalSpeed * slowdownMultiplier
	} else {
		return
	}

	const state = {
		remaining: duration,
		originalSpeed,
	} as SlowdownState
	state.controller = target.onUpdate(() => {
		state.remaining -= k.dt()
		if (state.remaining > 0) return
		if (target.timescaleModifiers instanceof Map) {
			target.timescaleModifiers.delete(SLOWDOWN_TRAP_MODIFIER_ID)
		}
		if (state.originalSpeed !== undefined && typeof target.speed === "number") {
			target.speed = state.originalSpeed
		}
		state.controller?.cancel()
		slowdownStates.delete(target)
	})
	slowdownStates.set(target, state)
}

function isTrapCellTarget(target: TrapCellTarget) {
	if (!target.exists() || !target.pos || target.is(tags.roomTrap)) return false
	return target.is(tags.player) ||
		target.is(tags.unit) ||
		target.is(tags.projectile) ||
		target.is(tags.debree) ||
		target.is(tags.snareable) ||
		typeof target.speed === "number"
}
