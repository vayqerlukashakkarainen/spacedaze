import type { Vec2 } from "kaplay"
import { k } from "../main"
import { applyRadialGravity } from "../services/radialGravityService"
import { tags } from "../tags"

interface GravityPullProps {
	pos: Vec2
	radius?: number
	strength?: number
	falloff?: number
	targetTags: string[]
	tagStrengthMultipliers?: Record<string, number>
	visualizePull?: boolean
}

const PULL_STREAK_LIFETIME = 0.2
const MAX_STREAKS_PER_FRAME = 8

export function spawnGravityPull(props: GravityPullProps) {
	const nextStreakAt = new Map<number, number>()
	const gravity = k.add([
		k.pos(props.pos),
		{
			radius: props.radius ?? 0,
			strength: props.strength ?? 0,
			falloff: props.falloff ?? 1,
		},
		tags.props,
		tags.gameLoop,
	])

	gravity.onUpdate(() => {
		let streaksThisFrame = 0
		applyRadialGravity(gravity.pos, {
			strength: gravity.strength,
			range: gravity.radius,
			falloff: gravity.falloff,
			targetTags: props.targetTags,
			targetTagMode: "or",
			tagStrengthMultipliers: props.tagStrengthMultipliers,
			excludeIds: [gravity.id],
			onPull: props.visualizePull
				? (target, sample) => {
					if (streaksThisFrame >= MAX_STREAKS_PER_FRAME) return
					const now = k.time()
					if (now < (nextStreakAt.get(target.id) ?? 0)) return
					if (!nextStreakAt.has(target.id)) {
						target.onDestroy(() => nextStreakAt.delete(target.id))
					}
					nextStreakAt.set(target.id, now + k.rand(0.07, 0.13))
					streaksThisFrame++
					spawnPullStreak(
						target.pos,
						sample.direction,
						sample.strength
					)
				}
				: undefined,
		})
	})
	gravity.onDestroy(() => nextStreakAt.clear())

	return gravity
}

function spawnPullStreak(pos: Vec2, direction: Vec2, strength: number) {
	const intensity = k.clamp(strength, 0, 1)
	const tangent = direction.normal()
	const tailLength = k.lerp(5, 24, intensity)
	const bend = k.rand(-1, 1) * k.lerp(2, 7, intensity)
	const width = k.lerp(0.5, 1.4, intensity)
	const streak = k.add([
		k.pos(pos.clone()),
		k.opacity(k.lerp(0.25, 0.75, intensity)),
		k.lifespan(PULL_STREAK_LIFETIME, { fade: 0.12 }),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / PULL_STREAK_LIFETIME, 0, 1)
				const pull = direction.scale(tailLength * (1 + progress * 0.45))
				const curve = tangent.scale(bend * (1 - progress * 0.5))
				const midpoint = pull.scale(-0.48).add(curve)
				const tail = pull.scale(-1)
				k.drawLine({
					p1: k.vec2(),
					p2: midpoint,
					width,
					color: k.WHITE,
					opacity: this.opacity,
				})
				k.drawLine({
					p1: midpoint,
					p2: tail,
					width: Math.max(0.35, width * 0.65),
					color: k.WHITE,
					opacity: this.opacity * 0.7,
				})
			},
		},
		tags.props,
		tags.gameLoop,
	])

	streak.onUpdate(() => {
		streak.elapsed += k.dt()
		streak.pos = streak.pos.add(direction.scale(25 * intensity * k.dt()))
	})
}
