import type { GameObj, Vec2 } from "kaplay"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { gridRegistry } from "../../grid/gridRegistry"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { k } from "../../main"
import { tags } from "../../tags"
import { querySpatialNearby } from "../core/runtimeSpatialIndexService"

const PULSE_HALF_LIFE_SECONDS = 0.12
const MIN_PULSE_SPEED = 5

interface PulseTarget extends GameObj {
	hb?: number
	snareMass?: number
	snareVelocity?: Vec2
	snareAngularVelocity?: number
	explosionPulseVelocity?: Vec2
	hasExplosionPulseUpdate?: boolean
	getTimescale?: () => number
}

interface ExplosionForceOptions {
	excludeIds?: readonly number[] | ReadonlySet<number>
}

interface ExplosionForceCandidate {
	target: PulseTarget
	influencePosition: Vec2
	distance: number
}

const EXPLOSION_FORCE_TARGET_TAGS = [
	tags.player,
	tags.enemy,
	tags.friendly,
	tags.pushable,
	tags.snareable,
	tags.persistentShipPart,
	tags.trainingTarget,
]

export function applyDefaultExplosionForce(
	origin: Vec2,
	damageRadius: number,
	options: ExplosionForceOptions = {}
) {
	applyExplosionForce(
		origin,
		damageRadius * 1.15,
		k.clamp(damageRadius * 1.35, 48, 190),
		options
	)
}

export function applyExplosionForce(
	origin: Vec2,
	radius: number,
	strength: number,
	options: ExplosionForceOptions = {}
) {
	if (strength <= 0 || radius <= 0) return
	const candidates = new Map<number, ExplosionForceCandidate>()
	const excludeIds = options.excludeIds
	const registerCandidate = (gameObj: GameObj) => {
		if (!gameObj.exists() || gameObj.hidden || !gameObj.pos) return
		if (isExcluded(gameObj.id, excludeIds)) return
		const influencePosition = getWorldPosition(gameObj)
		const distance = influencePosition.dist(origin)
		if (distance > radius) return
		const target = resolveMotionTarget(gameObj) as PulseTarget
		if (!target.exists() || isExcluded(target.id, excludeIds)) return
		const previous = candidates.get(target.id)
		if (previous && previous.distance <= distance) return
		candidates.set(target.id, { target, influencePosition, distance })
	}

	for (const target of querySpatialNearby(origin, radius, {
		anyTags: EXPLOSION_FORCE_TARGET_TAGS,
		excludeIds,
	})) registerCandidate(target)
	for (const part of k.get(tags.part, { recursive: true })) {
		registerCandidate(part)
	}
	for (const candidate of candidates.values()) {
		applyExplosionForceCandidate(candidate, origin, radius, strength)
	}
}

export function applyExplosionPulse(
	targets: GameObj[],
	origin: Vec2,
	radius: number,
	strength: number
) {
	if (strength <= 0 || radius <= 0) return

	for (const gameObj of targets) {
		const target = gameObj as PulseTarget
		if (!target.exists() || !target.pos) continue

		const offset = getWorldPosition(target).sub(origin)
		const distance = offset.len()
		if (distance > radius) continue
		applyExplosionForceCandidate(
			{ target, influencePosition: getWorldPosition(target), distance },
			origin,
			radius,
			strength
		)
	}
}

function applyExplosionForceCandidate(
	candidate: ExplosionForceCandidate,
	origin: Vec2,
	radius: number,
	strength: number
) {
	const target = candidate.target
	const offset = candidate.influencePosition.sub(origin)
	const direction = candidate.distance > 0.001
		? offset.scale(1 / candidate.distance)
		: k.Vec2.fromAngle(k.rand(0, 360))
	const falloff = 0.2 + 0.8 * (1 - candidate.distance / radius)
	const resistance = getExplosionForceResistance(target)
	const impulse = direction.scale((strength * falloff) / resistance)
	if (target.snareVelocity?.add) {
		target.snareVelocity = target.snareVelocity.add(impulse)
		if (typeof target.snareAngularVelocity === "number") {
			const spinDirection = target.id % 2 === 0 ? -1 : 1
			target.snareAngularVelocity += spinDirection * impulse.len() * 0.8
		}
		return
	}
	target.explosionPulseVelocity = (
		target.explosionPulseVelocity ?? k.vec2(0, 0)
	).add(impulse)
	registerPulseUpdate(target)
}

function getExplosionForceResistance(target: PulseTarget) {
	const sizeResistance = Math.max(1, (target.hb ?? 16) / 16)
	const massResistance = Math.max(1, target.snareMass ?? 1)
	const rankResistance = target.is(tags.boss)
		? 4
		: target.is(tags.elite)
			? 2
			: 1
	return Math.max(sizeResistance, massResistance) * rankResistance
}

function resolveMotionTarget(gameObj: GameObj) {
	if (!gameObj.is(tags.part) || !gameObj.parent) return gameObj
	let owner = gameObj.parent as GameObj | undefined
	while (owner && !isDynamicForceTarget(owner)) {
		owner = owner.parent
	}
	return owner ?? gameObj
}

function isDynamicForceTarget(gameObj: GameObj) {
	return EXPLOSION_FORCE_TARGET_TAGS.some((tag) => gameObj.is(tag))
}

function getWorldPosition(gameObj: GameObj) {
	return gameObj.worldPos?.clone() ?? gameObj.pos.clone()
}

function isExcluded(
	id: number,
	excludedIds: readonly number[] | ReadonlySet<number> | undefined
) {
	if (!excludedIds) return false
	return Array.isArray(excludedIds)
		? excludedIds.includes(id)
		: (excludedIds as ReadonlySet<number>).has(id)
}

function registerPulseUpdate(target: PulseTarget) {
	if (target.hasExplosionPulseUpdate) return
	target.hasExplosionPulseUpdate = true

	registerBatchedEntityUpdate("effects", target, () => {
		const velocity = target.explosionPulseVelocity
		if (!velocity || velocity.len() < MIN_PULSE_SPEED) {
			target.explosionPulseVelocity = undefined
			return
		}

		const timescale = target.getTimescale ? target.getTimescale() : 1
		const delta = k.dt() * timescale
		const nextPos = target.pos.add(velocity.scale(delta))
		if (canPulseMoveTo(nextPos)) {
			target.pos = nextPos
		} else {
			target.explosionPulseVelocity = undefined
			return
		}

		const decay = Math.pow(0.5, delta / PULSE_HALF_LIFE_SECONDS)
		target.explosionPulseVelocity = velocity.scale(decay)
	})
}

function canPulseMoveTo(pos: Vec2) {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid) return true
	const coord = grid.screenToHex(pos)
	return grid.inBounds(coord) && grid.isWalkable(coord)
}
