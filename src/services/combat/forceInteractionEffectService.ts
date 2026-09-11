import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { playVisualHitKnockback } from "./visualHitKnockbackService"

interface InwardForceConeOptions {
	origin: () => Vec2 | undefined
	direction: () => Vec2 | undefined
	radius: number
	halfAngle: number
	duration: number
	intensity?: number
	color?: Color
	extraTags?: string[]
	shakeTags?: string[]
}

interface ForceParticle {
	position: Vec2
	speed: number
	size: number
	opacity: number
	twirl: number
}

export function spawnInwardForceCone(options: InwardForceConeOptions) {
	const intensity = k.clamp(options.intensity ?? 1, 0.25, 2)
	const color = options.color ?? k.WHITE
	const particleCount = Math.round(42 * intensity)
	const particles: ForceParticle[] = []
	const controller = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(4),
		{
			elapsed: 0,
			shakeTimer: 0,
			draw() {
				for (const particle of particles) {
					k.drawRect({
						pos: particle.position,
						width: particle.size * 2.6,
						height: particle.size,
						anchor: "center",
						color,
						opacity: particle.opacity,
					})
				}
			},
		},
		tags.props,
		tags.gameLoop,
		...(options.extraTags ?? []),
	])

	const resetParticle = (particle: ForceParticle, initial = false) => {
		const origin = options.origin()
		const direction = options.direction()
		if (!origin || !direction || direction.len() <= 0.001) return
		const distance = initial
			? k.rand(options.radius * 0.18, options.radius)
			: options.radius * k.rand(0.78, 1)
		const angle = direction.angle() + k.rand(-options.halfAngle, options.halfAngle)
		particle.position = origin.add(k.Vec2.fromAngle(angle).scale(distance))
		particle.speed = k.rand(120, 260) * intensity
		particle.size = k.rand(0.8, 2.2) * Math.min(1.35, intensity)
		particle.opacity = k.rand(0.22, 0.72)
		particle.twirl = k.rand(-38, 38)
	}

	for (let index = 0; index < particleCount; index++) {
		const particle: ForceParticle = {
			position: k.vec2(),
			speed: 0,
			size: 1,
			opacity: 1,
			twirl: 0,
		}
		resetParticle(particle, true)
		particles.push(particle)
	}

	registerBatchedEntityUpdate("effects", controller, () => {
		const origin = options.origin()
		const direction = options.direction()
		if (!origin || !direction || direction.len() <= 0.001) {
			k.destroy(controller)
			return
		}
		const delta = k.dt()
		controller.elapsed += delta
		controller.shakeTimer -= delta
		for (const particle of particles) {
			const offset = origin.sub(particle.position)
			if (offset.len() < 9) {
				resetParticle(particle)
				continue
			}
			const tangent = offset.unit().normal().scale(
				Math.sin(controller.elapsed * 11 + particle.twirl) * 16
			)
			particle.position = particle.position.add(
				offset.unit().scale(particle.speed * delta).add(tangent.scale(delta))
			)
			particle.opacity = k.clamp(offset.len() / options.radius, 0.12, 0.78)
		}
		if (controller.shakeTimer <= 0) {
			controller.shakeTimer = 0.09
			shakeForceTargets(
				origin,
				direction.unit(),
				options.radius,
				options.halfAngle,
				options.shakeTags ?? [tags.roomEnvironment]
			)
		}
		if (controller.elapsed >= options.duration) k.destroy(controller)
	})
	return controller
}

function shakeForceTargets(
	origin: Vec2,
	direction: Vec2,
	radius: number,
	halfAngle: number,
	targetTags: string[]
) {
	const visited = new Set<number>()
	for (const tag of targetTags) {
		for (const target of k.get(tag) as GameObj[]) {
			if (!target.exists() || visited.has(target.id) || !target.pos) continue
			visited.add(target.id)
			const offset = target.pos.sub(origin)
			if (offset.len() > radius || offset.len() <= 0.001) continue
			if (Math.abs(shortestAngleDelta(direction.angle(), offset.angle())) > halfAngle) {
				continue
			}
			playVisualHitKnockback(target, origin.sub(target.pos))
		}
	}
}

function shortestAngleDelta(from: number, to: number) {
	return ((to - from + 540) % 360) - 180
}
