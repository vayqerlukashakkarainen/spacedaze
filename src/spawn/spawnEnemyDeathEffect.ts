import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { explosionEmitter } from "../particles"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { tags } from "../tags"
import { spawnExplosionEffect, spawnFlash } from "./spawnFlash"
import { spawnRing } from "./spawnRing"

const FRAGMENT_SPRITES = [
	"debree_part1",
	"particle1",
	"particle2",
	"particle3",
	"particle4",
] as const

export type EnemyDeathTier = "normal" | "elite" | "boss"

interface EnemyDeathProfile {
	color: Color
	fragmentMultiplier: number
	particleMultiplier: number
	burstCount: number
	shake: number
}

interface EnemyDeathEffectOptions {
	particleScale?: number
}

interface MiniBossDeathSequenceOptions {
	radius: number
	color?: Color
	onComplete: () => void
}

const MINI_BOSS_DAMAGE_STAGE_DURATION = 2
const MINI_BOSS_GODRAY_STAGE_DURATION = 2
const MINI_BOSS_DEATH_DURATION =
	MINI_BOSS_DAMAGE_STAGE_DURATION + MINI_BOSS_GODRAY_STAGE_DURATION
const MINI_BOSS_FINAL_SHAKE = 14

export function spawnMiniBossDeathSequence(
	body: GameObj,
	options: MiniBossDeathSequenceOptions
) {
	const deathPos = body.pos.clone()
	const deathAngle = body.angle
	const color = options.color ?? k.rgb(125, 220, 255)
	const rays: GameObj[] = []
	let core: GameObj | undefined
	const controller = k.add([
		k.pos(deathPos),
		{
			elapsed: 0,
			burstTimer: 0,
			godraysStarted: false,
			completed: false,
		},
		tags.props,
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", controller, () => {
		controller.elapsed += k.dt()
		controller.burstTimer -= k.dt()
		const sequenceProgress = k.clamp(
			controller.elapsed / MINI_BOSS_DEATH_DURATION,
			0,
			1
		)
		if (body.exists()) {
			const instability = k.lerp(0.45, 4.5, sequenceProgress * sequenceProgress)
			body.pos = deathPos.add(k.vec2(
				Math.sin(controller.elapsed * 43) * instability,
				Math.cos(controller.elapsed * 51) * instability
			))
			body.angle = deathAngle +
				Math.sin(controller.elapsed * 37) * instability * 0.9
		}
		const godrayProgress = k.clamp(
			(controller.elapsed - MINI_BOSS_DAMAGE_STAGE_DURATION) /
				MINI_BOSS_GODRAY_STAGE_DURATION,
			0,
			1
		)
		const burstInterval = godrayProgress > 0 ? 0.11 : 0.24
		if (controller.burstTimer <= 0) {
			controller.burstTimer += burstInterval
			const offset = k.Vec2.fromAngle(k.rand(0, 360)).scale(
				k.rand(options.radius * 0.18, options.radius)
			)
			spawnExplosionEffect(deathPos.add(offset), k.rand(7, 14), {
				ringIntensity: 0.08,
				particleCount: godrayProgress > 0 ? 7 : 4,
				color,
			})
		}

		if (!controller.godraysStarted && godrayProgress > 0) {
			controller.godraysStarted = true
			for (let index = 0; index < 10; index++) {
				const ray = k.add([
					k.pos(deathPos),
					k.polygon([
						k.vec2(0, -1.5),
						k.vec2(options.radius * 4.5, 0),
						k.vec2(0, 1.5),
					]),
					k.anchor("left"),
					k.rotate(index * 36 + k.rand(-8, 8)),
					k.color(color),
					k.opacity(0),
					k.scale(0.05, 1),
					k.layer(layers.gameEffects),
					k.z(-1),
					k.blend(k.BlendMode.Add),
					tags.props,
					tags.gameLoop,
				])
				rays.push(ray)
			}
			core = k.add([
				k.pos(deathPos),
				k.circle(options.radius * 0.35),
				k.anchor("center"),
				k.color(color),
				k.opacity(0),
				k.scale(0.2),
				k.layer(layers.gameEffects),
				k.z(2),
				k.blend(k.BlendMode.Add),
				tags.props,
				tags.gameLoop,
			])
		}

		if (godrayProgress > 0) {
			for (let index = 0; index < rays.length; index++) {
				const ray = rays[index]
				if (!ray.exists()) continue
				const flicker = k.wave(0.7, 1, k.time() * (9 + index * 0.7))
				ray.opacity = k.lerp(0.08, 0.78, godrayProgress) * flicker
				ray.scale = k.vec2(
					k.lerp(0.05, 1.15, godrayProgress),
					k.lerp(0.5, 2.4, godrayProgress)
				)
			}
			if (core?.exists()) {
				core.opacity = k.lerp(0.15, 1, godrayProgress)
				core.scale = k.vec2(
					k.lerp(0.2, 1.5, godrayProgress) *
					k.wave(0.9, 1.08, k.time() * 12)
				)
			}
			if (body.exists()) {
				body.opacity = k.wave(0.58, 1, k.time() * (10 + godrayProgress * 16))
			}
		}

		if (controller.elapsed < MINI_BOSS_DEATH_DURATION) return
		controller.completed = true
		restoreMiniBossTransform(body, deathPos, deathAngle)
		cleanupMiniBossCharge(rays, core)
		k.destroy(controller)
		spawnMiniBossFinalBlast(deathPos, options.radius, color)
		options.onComplete()
		k.shake(MINI_BOSS_FINAL_SHAKE)
	})

	controller.onDestroy(() => {
		if (controller.completed) return
		restoreMiniBossTransform(body, deathPos, deathAngle)
		cleanupMiniBossCharge(rays, core)
	})
	return controller
}

function spawnMiniBossFinalBlast(pos: Vec2, radius: number, color: Color) {
	k.flash(k.WHITE, 0.28)
	spawnExplosionEffect(pos, radius * 3, {
		ringIntensity: 0.85,
		particleCount: 64,
		color,
	})
	spawnFlash(pos, radius * 2.35, k.WHITE)
	spawnRing({
		pos,
		speed: 420,
		intensity: 1.15,
		maxRadius: radius * 7,
		visualize: true,
		color,
		effectWidth: 46,
		outlineWidth: 4,
		visualOpacity: 0.85,
	})
}

function restoreMiniBossTransform(body: GameObj, pos: Vec2, angle: number) {
	if (!body.exists()) return
	body.pos = pos
	body.angle = angle
}

function cleanupMiniBossCharge(rays: GameObj[], core?: GameObj) {
	for (const ray of rays) {
		if (ray.exists()) k.destroy(ray)
	}
	if (core?.exists()) k.destroy(core)
}

export function spawnEnemyDeathEffect(
	pos: Vec2,
	intensity: number = 1,
	tier: EnemyDeathTier = "normal",
	options: EnemyDeathEffectOptions = {}
) {
	const profile = getDeathProfile(tier)
	const effectIntensity = k.clamp(intensity, 0.35, 1.45)
	const particleScale = k.clamp(options.particleScale ?? 1, 0, 2)
	const normalizedIntensity = (effectIntensity - 0.35) / 1.1
	const fragmentCount = Math.round(
		k.lerp(4, 14, normalizedIntensity) * profile.fragmentMultiplier
	)
	spawnExplosionEffect(pos, 13 * effectIntensity, {
		ringIntensity: tier === "boss" ? 0.62 : tier === "elite" ? 0.4 : 0.24,
		particleCount: Math.round(
			18 * effectIntensity * profile.particleMultiplier * particleScale
		),
		color: profile.color,
	})
	spawnFlash(pos, 5 * effectIntensity, profile.color)
	if (tier !== "normal") {
		spawnRing({
			pos,
			speed: tier === "boss" ? 270 : 220,
			intensity: tier === "boss" ? 0.7 : 0.42,
			maxRadius: 23 * effectIntensity,
			visualize: true,
			color: profile.color,
		})
	}
	k.shake(profile.shake)

	for (let burstIndex = 0; burstIndex < profile.burstCount; burstIndex++) {
		k.wait(0.05 + burstIndex * 0.055, () => {
			const direction = k.Vec2.fromAngle(k.rand(0, 360))
			const burstDistance = tier === "boss" ? k.rand(7, 17) : k.rand(4, 10)
			const burstPos = pos.add(direction.scale(burstDistance * effectIntensity))
			explosionEmitter.emitter.position = burstPos
			explosionEmitter.emit(Math.round(
				7 * effectIntensity * profile.particleMultiplier * particleScale
			))
			spawnFlash(burstPos, 3.5 * effectIntensity, profile.color)
		})
	}

	for (let index = 0; index < fragmentCount; index++) {
		spawnDeathFragment(pos, effectIntensity, index, fragmentCount, profile.color)
	}
}

function getDeathProfile(tier: EnemyDeathTier): EnemyDeathProfile {
	if (tier === "boss") {
		return {
			color: k.rgb(255, 78, 78),
			fragmentMultiplier: 1.8,
			particleMultiplier: 1.7,
			burstCount: 4,
			shake: 9,
		}
	}
	if (tier === "elite") {
		return {
			color: k.rgb(70, 205, 255),
			fragmentMultiplier: 1.35,
			particleMultiplier: 1.25,
			burstCount: 2,
			shake: 2.2,
		}
	}
	return {
		color: k.WHITE,
		fragmentMultiplier: 1,
		particleMultiplier: 1,
		burstCount: 1,
		shake: 0.28,
	}
}

function spawnDeathFragment(
	pos: Vec2,
	intensity: number,
	index: number,
	pieceCount: number,
	color: Color
) {
	const direction = k.Vec2.fromAngle(
		(index / Math.max(1, pieceCount)) * 360 + k.rand(-18, 18)
	)
	const speed = k.rand(38, 92) * intensity
	const lifetime = k.rand(0.65, 1.15)
	const fragment = k.add([
		k.pos(pos.add(direction.scale(k.rand(1, 5)))),
		k.sprite(k.choose(FRAGMENT_SPRITES)),
		k.anchor("center"),
		k.rotate(k.rand(0, 360)),
		k.scale(k.rand(0.32, 0.72) * intensity),
		k.color(color),
		k.opacity(1),
		k.layer(layers.gameEffects),
		k.lifespan(lifetime, { fade: Math.min(0.35, lifetime * 0.4) }),
		{
			velocity: direction.scale(speed),
			angularVelocity: k.rand(-320, 320),
			initialScale: 1,
			elapsed: 0,
			lifetime,
		},
		tags.props,
		tags.gameLoop,
	])
	fragment.initialScale = fragment.scale.x

	registerBatchedEntityUpdate("effects", fragment, () => {
		fragment.elapsed += k.dt()
		fragment.velocity = fragment.velocity.scale(
			Math.pow(0.965, k.dt() * 60)
		)
		fragment.pos = fragment.pos.add(fragment.velocity.scale(k.dt()))
		fragment.angle += fragment.angularVelocity * k.dt()
		const progress = k.clamp(fragment.elapsed / fragment.lifetime, 0, 1)
		fragment.scale = k.vec2(
			fragment.initialScale * k.lerp(1, 0.55, progress)
		)
	})
}
