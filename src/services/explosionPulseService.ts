import type { GameObj, Vec2 } from "kaplay"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { registerBatchedEntityUpdate } from "./entityUpdateService"
import { k } from "../main"

const PULSE_HALF_LIFE_SECONDS = 0.12
const MIN_PULSE_SPEED = 5

interface PulseTarget extends GameObj {
	hb?: number
	explosionPulseVelocity?: Vec2
	hasExplosionPulseUpdate?: boolean
	getTimescale?: () => number
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

		const offset = target.pos.sub(origin)
		const distance = offset.len()
		if (distance > radius) continue

		const direction =
			distance > 0.001
				? offset.scale(1 / distance)
				: k.Vec2.fromAngle(k.rand(0, 360))
		const falloff = 0.2 + 0.8 * (1 - distance / radius)
		const resistance = Math.max(1, (target.hb ?? 16) / 16)
		const impulse = direction.scale((strength * falloff) / resistance)
		target.explosionPulseVelocity = (
			target.explosionPulseVelocity ?? k.vec2(0, 0)
		).add(impulse)

		registerPulseUpdate(target)
	}
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
