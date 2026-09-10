import type { Comp, GameObj, PosComp, Vec2 } from "kaplay"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { dt, k } from "../main"
import { tags } from "../tags"

const STOP_SPEED = 3
const STOP_ANGULAR_SPEED = 2
const MAX_ANGULAR_SPEED = 540
const MAX_FRAME_STEP = 1 / 30

interface SnareMotionState {
	snared?: boolean
	snareVelocity?: Vec2
	returningFromSnare?: boolean
}

export function isSnareMotionActive(object: SnareMotionState) {
	return object.snared === true ||
		(object.snareVelocity?.len() ?? 0) >= STOP_SPEED ||
		object.returningFromSnare === true
}

export interface SnareableOptions {
	mass?: number
	force?: number
	forceDirection?: Vec2
	radius?: number
	releaseDrag?: number
	angularDrag?: number
	returnAfterRelease?: boolean
	returnSpeed?: number
	suspendTimescaleWhileMoving?: boolean
	canSnare?: () => boolean
	onSnareStart?: () => void
	onSnareEnd?: (velocity: Vec2) => void
}

export interface SnareableComp extends Comp {
	snareMass: number
	snareForce: number
	snareForceDirection: Vec2
	snareRadius: number
	snareReleaseDrag: number
	snareVelocity: Vec2
	snareAngularVelocity: number
	snared: boolean
	returningFromSnare: boolean
	setSnareForce(force: number, direction?: Vec2): void
	canBeSnared(): boolean
	beginSnare(): boolean
	releaseSnare(velocity?: Vec2): void
	applySnareTorque(angularAcceleration: number, deltaSeconds: number): void
	advanceSnareMotion(deltaSeconds: number): boolean
	consumeSnareRoomImpact(): Vec2 | undefined
}

type SnareableObject = GameObj<PosComp | SnareableComp>

interface TimescaleCarrier {
	timescaleModifiers?: Map<number, number>
}

const SNARE_TIMESCALE_MODIFIER_ID = -73_501

export function snareable(
	options: SnareableOptions = {}
): SnareableComp {
	let pendingRoomImpactVelocity: Vec2 | undefined
	let returnPosition: Vec2 | undefined
	let returnAngle: number | undefined
	return {
		id: "snareable",
		require: ["pos"],
		snareMass: Math.max(0.1, options.mass ?? 1),
		snareForce: Math.max(0, options.force ?? 0),
		snareForceDirection: options.forceDirection?.len()
			? options.forceDirection.unit()
			: k.vec2(0, 0),
		snareRadius: Math.max(1, options.radius ?? 12),
		snareReleaseDrag: Math.max(0, options.releaseDrag ?? 2.2),
		snareVelocity: k.vec2(0, 0),
		snareAngularVelocity: 0,
		snared: false,
		returningFromSnare: false,

		add() {
			this.tag(tags.snareable)
		},

		setSnareForce(force, direction) {
			this.snareForce = Math.max(0, force)
			if (direction && direction.len() > 0.001) {
				this.snareForceDirection = direction.unit()
			}
			if (this.snared) {
				setSnareTimescaleSuspended(
					this,
					options,
					this.snareForce <= 0
				)
			}
		},

		canBeSnared() {
			return !this.snared && (options.canSnare?.() ?? true)
		},

		beginSnare() {
			if (!this.canBeSnared()) return false
			if (options.returnAfterRelease && !returnPosition) {
				returnPosition = this.pos.clone()
				if (typeof this.angle === "number") {
					this.angle = normalizeAngle(this.angle)
					returnAngle = this.angle
				}
			}
			if (
				typeof this.angle === "number" &&
				Math.abs(this.snareAngularVelocity) < STOP_ANGULAR_SPEED
			) {
				const spinDirection = this.id % 2 === 0 ? -1 : 1
				this.snareAngularVelocity = spinDirection *
					(42 / Math.sqrt(this.snareMass))
			}
			this.returningFromSnare = false
			this.snared = true
			pendingRoomImpactVelocity = undefined
			setSnareTimescaleSuspended(this, options, this.snareForce <= 0)
			options.onSnareStart?.()
			return true
		},

		releaseSnare(velocity?: Vec2) {
			if (velocity) this.snareVelocity = velocity.clone()
			if (!this.snared) return
			this.snared = false
			if (this.snareVelocity.len() < STOP_SPEED) {
				setSnareTimescaleSuspended(this, options, false)
				this.returningFromSnare = returnPosition !== undefined
			}
			options.onSnareEnd?.(this.snareVelocity.clone())
		},

		applySnareTorque(angularAcceleration, deltaSeconds) {
			this.snareAngularVelocity = k.clamp(
				this.snareAngularVelocity + angularAcceleration * deltaSeconds,
				-MAX_ANGULAR_SPEED,
				MAX_ANGULAR_SPEED
			)
		},

		advanceSnareMotion(deltaSeconds: number) {
			const impactVelocity = this.snareVelocity.clone()
			const unobstructed = advanceWithRoomCollision(
				this as SnareableObject,
				Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_STEP)
			)
			if (!unobstructed && impactVelocity.len() > 0.001) {
				pendingRoomImpactVelocity = impactVelocity
				this.snareAngularVelocity *= -0.58
			}
			advanceSnareRotation(this, options, deltaSeconds)
			return unobstructed
		},

		consumeSnareRoomImpact() {
			const impactVelocity = pendingRoomImpactVelocity
			pendingRoomImpactVelocity = undefined
			return impactVelocity
		},

		update() {
			if (this.snared) return
			const deltaSeconds = Math.min(dt(), MAX_FRAME_STEP)
			if (deltaSeconds <= 0) return
			if (this.snareVelocity.len() < STOP_SPEED) {
				this.snareVelocity = k.vec2(0, 0)
				setSnareTimescaleSuspended(this, options, false)
				advanceSnareRotation(this, options, deltaSeconds)
				if (returnPosition) this.returningFromSnare = true
				if (!this.returningFromSnare || !returnPosition) return
				const toReturnPosition = returnPosition.sub(this.pos)
				const returnDistance = toReturnPosition.len()
				const returnStep = Math.max(1, options.returnSpeed ?? 90) * deltaSeconds
				if (returnDistance <= returnStep) {
					this.pos = returnPosition
					if (returnAngle !== undefined) this.angle = returnAngle
					returnPosition = undefined
					returnAngle = undefined
					this.returningFromSnare = false
					this.snareAngularVelocity = 0
					return
				}
				this.pos = this.pos.add(
					toReturnPosition.scale(returnStep / returnDistance)
				)
				if (returnAngle !== undefined && typeof this.angle === "number") {
					const angleDelta = shortestAngleDelta(this.angle, returnAngle)
					this.angle += angleDelta * (1 - Math.exp(-7 * deltaSeconds))
					this.snareAngularVelocity *= Math.exp(-5 * deltaSeconds)
				}
				return
			}
			this.advanceSnareMotion(deltaSeconds)
			this.snareVelocity = this.snareVelocity.scale(
				Math.exp(-this.snareReleaseDrag * deltaSeconds)
			)
		},
	}
}

function advanceSnareRotation(
	object: SnareableObject,
	options: SnareableOptions,
	deltaSeconds: number
) {
	if (typeof object.angle !== "number") return
	if (Math.abs(object.snareAngularVelocity) < STOP_ANGULAR_SPEED) {
		object.snareAngularVelocity = 0
		return
	}
	object.angle = normalizeAngle(
		object.angle + object.snareAngularVelocity * deltaSeconds
	)
	object.snareAngularVelocity *= Math.exp(
		-Math.max(0, options.angularDrag ?? 1.35) * deltaSeconds
	)
}

function normalizeAngle(angle: number) {
	return ((angle % 360) + 360) % 360
}

function shortestAngleDelta(from: number, to: number) {
	return normalizeAngle(to - from + 180) - 180
}

function setSnareTimescaleSuspended(
	object: TimescaleCarrier,
	options: SnareableOptions,
	suspended: boolean
) {
	if (!options.suspendTimescaleWhileMoving || !object.timescaleModifiers) return
	if (suspended) {
		object.timescaleModifiers.set(SNARE_TIMESCALE_MODIFIER_ID, 0)
	} else {
		object.timescaleModifiers.delete(SNARE_TIMESCALE_MODIFIER_ID)
	}
}

function advanceWithRoomCollision(
	object: SnareableObject,
	deltaSeconds: number
) {
	const movement = object.snareVelocity.scale(deltaSeconds)
	if (movement.len() <= 0.001) return true
	const start = object.pos.clone()
	const destination = start.add(movement)
	if (canMoveTo(object, destination)) {
		object.pos = destination
		return true
	}

	const horizontal = start.add(movement.x, 0)
	const vertical = start.add(0, movement.y)
	const horizontalFirst = Math.abs(movement.x) >= Math.abs(movement.y)
	const candidates = horizontalFirst
		? [horizontal, vertical]
		: [vertical, horizontal]

	for (const candidate of candidates) {
		if (!canMoveTo(object, candidate)) continue
		object.pos = candidate
		if (candidate === horizontal) {
			object.snareVelocity = k.vec2(object.snareVelocity.x, 0)
		} else {
			object.snareVelocity = k.vec2(0, object.snareVelocity.y)
		}
		return false
	}

	object.snareVelocity = k.vec2(0, 0)
	return false
}

function canMoveTo(object: SnareableObject, position: Vec2) {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid) return true
	const radius = object.snareRadius
	const footprint = [
		position,
		position.add(radius, 0),
		position.add(-radius, 0),
		position.add(0, radius),
		position.add(0, -radius),
	]
	return footprint.every((point) => {
		const coord = grid.screenToHex(point)
		return grid.inBounds(coord) && grid.isWalkable(coord)
	})
}
