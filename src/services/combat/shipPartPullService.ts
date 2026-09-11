import type { GameObj, HealthComp, PosComp, Vec2 } from "kaplay"
import { getTargetWorldPosition } from "./targetingService"

export interface PullableShipPartOptions {
	pullForce: number
	pullDuration?: number
	detach: (direction: Vec2) => GameObj | undefined
}

export interface PullableShipPartTarget {
	obj: PullableShipPartObject
	owner: GameObj<PosComp>
	hitRadius: number
	pullForce: number
	pullDuration: number
	getPosition(): Vec2
	detach(direction: Vec2): GameObj | undefined
	isAvailable(): boolean
}

type PullableShipPartObject = GameObj<PosComp | HealthComp> & {
	jitter?: (intensity: number) => void
}

const DEFAULT_PULL_DURATION = 0.72
const pullableParts = new Map<number, PullableShipPartTarget>()

export function registerPullableShipPart(
	obj: PullableShipPartObject,
	owner: GameObj<PosComp>,
	hitRadius: number,
	options: PullableShipPartOptions
) {
	const target: PullableShipPartTarget = {
		obj,
		owner,
		hitRadius: Math.max(1, hitRadius),
		pullForce: Math.max(1, options.pullForce),
		pullDuration: Math.max(
			0.1,
			options.pullDuration ?? DEFAULT_PULL_DURATION
		),
		getPosition: () => getTargetWorldPosition(obj),
		detach: options.detach,
		isAvailable: () => isPullablePartAvailable(obj, owner),
	}
	pullableParts.set(obj.id, target)
	obj.onDestroy(() => pullableParts.delete(obj.id))
	obj.onDeath(() => pullableParts.delete(obj.id))
	owner.onDestroy(() => pullableParts.delete(obj.id))
	return target
}

export function queryPullableShipParts(position: Vec2, radius: number) {
	const targets: PullableShipPartTarget[] = []
	for (const target of pullableParts.values()) {
		if (!target.isAvailable()) continue
		if (
			target.getPosition().dist(position) > radius + target.hitRadius
		) continue
		targets.push(target)
	}
	return targets
}

function isPullablePartAvailable(obj: GameObj, owner: GameObj) {
	return obj.exists() &&
		owner.exists() &&
		!obj.hidden &&
		!owner.hidden &&
		(typeof obj.hp !== "number" || obj.hp > 0) &&
		(typeof owner.hp !== "number" || owner.hp > 0)
}
