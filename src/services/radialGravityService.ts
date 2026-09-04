import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import { forEachSpatialNearby } from "./runtimeSpatialIndexService"

export interface RadialGravityConfig {
	strength: number
	range: number
	falloff?: number
	targetTags?: string[]
	targetTagMode?: "and" | "or"
	tagStrengthMultipliers?: Record<string, number>
	excludeIds?: number[]
	onPull?: (target: GameObj, sample: RadialGravitySample) => void
}

export interface RadialGravitySample {
	direction: Vec2
	distance: number
	normalizedDistance: number
	strength: number
}

export function applyRadialGravity(
	sourcePos: Vec2,
	config: RadialGravityConfig
) {
	if (config.strength <= 0 || config.range <= 0) return
	const tagMode = config.targetTagMode ?? "and"
	const targetTags = config.targetTags?.length ? config.targetTags : ["mass"]
	forEachSpatialNearby(sourcePos, config.range, {
		allTags: tagMode === "and" ? targetTags : undefined,
		anyTags: tagMode === "or" ? targetTags : undefined,
		excludeIds: config.excludeIds,
	}, (target) => {
		const distance = sourcePos.dist(target.pos)
		if (distance < 1) return

		const direction = sourcePos.sub(target.pos).unit()
		const normalizedDistance = distance / config.range
		const falloffMultiplier = Math.pow(
			1 - normalizedDistance,
			config.falloff ?? 0.5
		)
		const targetTimescale = target.getTimescale ? target.getTimescale() : 1
		const strengthMultiplier = Object.entries(
			config.tagStrengthMultipliers ?? {}
		).reduce(
			(current, [tag, multiplier]) =>
				target.is(tag) ? Math.max(current, multiplier) : current,
			1
		)
		const distanceThisFrame =
			config.strength *
			strengthMultiplier *
			falloffMultiplier *
			k.dt() *
			targetTimescale
		const steeringAmount = 1 - Math.exp(
			-(config.strength * strengthMultiplier / 55) *
				falloffMultiplier *
				k.dt() *
				targetTimescale
		)
		config.onPull?.(target, {
			direction,
			distance,
			normalizedDistance,
			strength: falloffMultiplier,
		})
		if (target.gravitySteerable && target.gravityVelocity) {
			target.gravityVelocity = target.gravityVelocity.add(
				direction.scale(
					config.strength *
						strengthMultiplier *
						falloffMultiplier *
						(target.gravitySteeringMultiplier ?? 1)
				)
			)
			return
		}
		const steered = steerMovementVector(
			target,
			direction,
			steeringAmount
		)
		if (!steered) {
			target.pos = target.pos.add(direction.scale(distanceThisFrame))
		}
	})
}

function steerMovementVector(
	target: GameObj,
	direction: Vec2,
	amount: number
) {
	for (const key of ["velocity", "vel", "dir"] as const) {
		const current = target[key] as Vec2 | undefined
		if (!current || typeof current.len !== "function" || current.len() <= 0) {
			continue
		}

		const magnitude = current.len()
		const steered = current
			.unit()
			.lerp(direction, amount)
		if (steered.len() <= 0) return true
		target[key] = steered.unit().scale(magnitude)

		if (key === "dir" && target.is("projectile") && target.angle !== undefined) {
			target.angle = k.rad2deg(k.Vec2.toAngle(target[key])) + 90
		}
		return true
	}
	return false
}
