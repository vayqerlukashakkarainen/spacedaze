import type { GameObj, PosComp, Vec2 } from "kaplay"
import type { TimescaleComp } from "../comp/timescale"
import { dt, k, layers } from "../main"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { forEachSpatialNearby } from "../services/core/runtimeSpatialIndexService"
import { tags } from "../tags"

const PHASE_WAKE_DURATION = 5
const PHASE_WAKE_RADIUS = 22
const PHASE_WAKE_TIMESCALE = 0.48

interface PhaseWakeProps {
	start: Vec2
	end: Vec2
	player: GameObj<PosComp>
	onPlayerCross: (wakeDirection: Vec2) => void
}

export function spawnPhaseWake(props: PhaseWakeProps) {
	const delta = props.end.sub(props.start)
	if (delta.len() <= 0.001) return

	const midpoint = props.start.lerp(props.end, 0.5)
	const queryRadius = delta.len() * 0.5 + PHASE_WAKE_RADIUS + 48
	const affectedObjects = new Map<number, GameObj<TimescaleComp & PosComp>>()
	let lifetime = 0
	let playerWasInside = true
	let playerCrossingArmed = false
	let playerBoostConsumed = false

	const wake = k.add([
		k.pos(props.start),
		k.opacity(0.42),
		k.layer(layers.gameEffects),
		{
			draw() {
				const fade = Math.max(0, 1 - lifetime / PHASE_WAKE_DURATION)
				const pulse = k.wave(0.78, 1, k.time() * 4)
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 5,
					color: k.rgb(35, 115, 145),
					opacity: this.opacity * fade * 0.32,
				})
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 2,
					color: k.rgb(80, 210, 255),
					opacity: this.opacity * fade * pulse,
				})
			},
		},
		tags.props,
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", wake, () => {
		lifetime += dt()
		if (lifetime >= PHASE_WAKE_DURATION) {
			k.destroy(wake)
			return
		}

		const currentlyAffected = new Set<number>()
		applyWakeSlow(midpoint, queryRadius, props.start, props.end, wake.id!, {
			allTags: [tags.enemy, tags.unit],
		}, affectedObjects, currentlyAffected)
		applyWakeSlow(midpoint, queryRadius, props.start, props.end, wake.id!, {
			allTags: [tags.enemy, tags.projectile],
		}, affectedObjects, currentlyAffected)

		for (const [objectId, obj] of affectedObjects) {
			if (obj.exists() && currentlyAffected.has(objectId)) continue
			affectedObjects.delete(objectId)
			if (obj.exists()) obj.timescaleModifiers.delete(wake.id!)
		}

		const playerInside = distanceToSegment(
			props.player.pos,
			props.start,
			props.end
		) <= PHASE_WAKE_RADIUS + 7
		if (!playerInside && playerWasInside) playerCrossingArmed = true
		if (
			playerInside &&
			!playerWasInside &&
			playerCrossingArmed &&
			!playerBoostConsumed
		) {
			playerBoostConsumed = true
			props.onPlayerCross(delta.unit())
		}
		playerWasInside = playerInside
	})

	wake.onDestroy(() => {
		for (const obj of affectedObjects.values()) {
			if (obj.exists()) obj.timescaleModifiers.delete(wake.id!)
		}
		affectedObjects.clear()
	})

	return wake
}

function applyWakeSlow(
	queryPos: Vec2,
	queryRadius: number,
	start: Vec2,
	end: Vec2,
	wakeId: number,
	query: { allTags: string[] },
	affectedObjects: Map<number, GameObj<TimescaleComp & PosComp>>,
	currentlyAffected: Set<number>
) {
	forEachSpatialNearby(queryPos, queryRadius, query, (candidate) => {
		if (
			!candidate.has("timescale") ||
			distanceToSegment(candidate.pos, start, end) > PHASE_WAKE_RADIUS
		) return
		const obj = candidate as GameObj<TimescaleComp & PosComp>
		currentlyAffected.add(obj.id!)
		if (affectedObjects.has(obj.id!)) return
		affectedObjects.set(obj.id!, obj)
		obj.timescaleModifiers.set(wakeId, PHASE_WAKE_TIMESCALE)
	})
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const delta = end.sub(start)
	const lengthSquared = delta.x * delta.x + delta.y * delta.y
	if (lengthSquared <= 0) return point.dist(start)
	const projection = k.clamp(
		((point.x - start.x) * delta.x + (point.y - start.y) * delta.y) /
			lengthSquared,
		0,
		1
	)
	return point.dist(start.add(delta.scale(projection)))
}
