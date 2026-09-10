import type { GameObj, PosComp, Vec2 } from "kaplay"
import { tags } from "../../tags"
import { querySpatialNearby } from "../core/runtimeSpatialIndexService"

interface TargetingComponent {
	obj: GameObj<PosComp>
	owner: GameObj<PosComp>
	hitRadius: number
	ownerOffset?: Vec2
}

// Every enemy unit has an implicit body component. Multi-part enemies register
// their additional components here without changing the unit's enemy semantics.
const targetingComponents = new Map<number, TargetingComponent>()

export function registerShipPartTarget(
	obj: GameObj<PosComp>,
	owner: GameObj<PosComp>,
	hitRadius: number,
	ownerOffset?: Vec2
) {
	const target = {
		obj,
		owner,
		hitRadius,
		ownerOffset: ownerOffset?.clone(),
	}
	targetingComponents.set(obj.id, target)
	obj.onDestroy(() => targetingComponents.delete(obj.id))
	owner.onDestroy(() => {
		if (targetingComponents.get(obj.id) === target) {
			targetingComponents.delete(obj.id)
		}
	})
}

export function getTargetWorldPosition(target: GameObj<PosComp>) {
	const partTarget = targetingComponents.get(target.id)
	if (!partTarget) return target.pos.clone()
	if (partTarget.ownerOffset) {
		return getTargetWorldPosition(partTarget.owner).add(
			partTarget.ownerOffset.rotate(partTarget.owner.angle ?? 0)
		)
	}
	return target.worldPos?.clone() ?? target.pos.clone()
}

export function getTargetHitRadius(target: GameObj) {
	const partTarget = targetingComponents.get(target.id)
	if (partTarget) return partTarget.hitRadius
	return typeof target.hb === "number" ? target.hb : 0
}

export function isPlayerTargetable(target: GameObj) {
	const partTarget = targetingComponents.get(target.id)
	if (partTarget) {
		return isLiveTarget(target) && isTargetableOwner(partTarget.owner)
	}
	return isRootTarget(target, [tags.enemy, tags.roomVolatile])
}

export function isProjectileTargetForTags(
	target: GameObj,
	targetTags: readonly string[]
) {
	const partTarget = targetingComponents.get(target.id)
	if (!partTarget) {
		return isRootTarget(target, targetTags)
	}
	if (!isLiveTarget(target)) return false
	if (!isTargetableOwner(partTarget.owner)) return false
	return targetTags.some((tag) => (
		target.is(tag) || partTarget.owner.is(tag)
	))
}

export function findClosestPlayerTarget(pos: Vec2, radius: number) {
	let closest: GameObj<PosComp> | undefined
	let closestDistanceSquared = radius * radius
	for (const candidate of querySpatialNearby(pos, radius, {
		allTags: [tags.unit],
		anyTags: [tags.enemy, tags.roomVolatile],
	})) {
		const distanceSquared = squaredDistance(
			pos,
			getTargetWorldPosition(candidate as GameObj<PosComp>)
		)
		if (distanceSquared >= closestDistanceSquared) continue
		closest = candidate as GameObj<PosComp>
		closestDistanceSquared = distanceSquared
	}
	for (const partTarget of targetingComponents.values()) {
		if (!isPlayerTargetable(partTarget.obj)) continue
		const distanceSquared = squaredDistance(
			pos,
			getTargetWorldPosition(partTarget.obj)
		)
		if (distanceSquared >= closestDistanceSquared) continue
		closest = partTarget.obj
		closestDistanceSquared = distanceSquared
	}
	return closest
}

export function findClosestProjectileTarget(
	pos: Vec2,
	radius: number,
	targetTags: readonly string[],
	excludeIds?: ReadonlySet<number>
) {
	let closest: GameObj<PosComp> | undefined
	let closestDistanceSquared = radius * radius
	for (const candidate of querySpatialNearby(pos, radius, {
		allTags: [tags.unit],
		anyTags: [...targetTags],
	})) {
		if (excludeIds?.has(candidate.id)) continue
		const distanceSquared = squaredDistance(
			pos,
			getTargetWorldPosition(candidate as GameObj<PosComp>)
		)
		if (distanceSquared >= closestDistanceSquared) continue
		closest = candidate as GameObj<PosComp>
		closestDistanceSquared = distanceSquared
	}
	for (const partTarget of targetingComponents.values()) {
		if (excludeIds?.has(partTarget.obj.id)) continue
		if (!isProjectileTargetForTags(partTarget.obj, targetTags)) continue
		const distanceSquared = squaredDistance(
			pos,
			getTargetWorldPosition(partTarget.obj)
		)
		if (distanceSquared >= closestDistanceSquared) continue
		closest = partTarget.obj
		closestDistanceSquared = distanceSquared
	}
	return closest
}

function isLiveTarget(target: GameObj) {
	return target.exists() &&
		!target.hidden &&
		(typeof target.hp !== "number" || target.hp > 0)
}

function isTargetableOwner(owner: GameObj) {
	return isLiveTarget(owner) &&
		isRootTarget(owner, [tags.enemy, tags.roomVolatile])
}

function isRootTarget(target: GameObj, targetTags: readonly string[]) {
	return target.exists() &&
		target.is(tags.unit) &&
		targetTags.some((tag) => target.is(tag))
}

function squaredDistance(first: Vec2, second: Vec2) {
	const dx = first.x - second.x
	const dy = first.y - second.y
	return dx * dx + dy * dy
}
