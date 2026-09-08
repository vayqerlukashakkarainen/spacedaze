import type { Color, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { explosionEmitter } from "../particles"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
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

const SHIP_WRECKAGE_SPRITES = [
	"enemy_ship1_left_wing",
	"enemy_ship1_right_wing",
	"enemy_ship1_body",
] as const

const MIN_WRECKAGE_LIFETIME = 3.8
const MAX_WRECKAGE_LIFETIME = 6.8

export type EnemyDeathTier = "normal" | "elite" | "boss"

interface EnemyDeathProfile {
	color: Color
	fragmentMultiplier: number
	particleMultiplier: number
	burstCount: number
	shake: number
	wreckageMultiplier: number
}

export function spawnEnemyDeathEffect(
	pos: Vec2,
	intensity: number = 1,
	spawnWreckage = true,
	tier: EnemyDeathTier = "normal"
) {
	const profile = getDeathProfile(tier)
	const effectIntensity = k.clamp(intensity, 0.35, 1.45)
	const normalizedIntensity = (effectIntensity - 0.35) / 1.1
	const fragmentCount = Math.round(
		k.lerp(4, 14, normalizedIntensity) * profile.fragmentMultiplier
	)
	const wreckageIntensity = k.clamp(intensity, 0.35, 2.5)
	const normalizedWreckageSize = (wreckageIntensity - 0.35) / 2.15
	const wreckageCount = Math.round(
		k.lerp(2, 7, normalizedWreckageSize) * profile.wreckageMultiplier
	)

	spawnExplosionEffect(pos, 13 * effectIntensity, {
		ringIntensity: tier === "boss" ? 0.62 : tier === "elite" ? 0.4 : 0.24,
		particleCount: Math.round(
			18 * effectIntensity * profile.particleMultiplier
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
				7 * effectIntensity * profile.particleMultiplier
			))
			spawnFlash(burstPos, 3.5 * effectIntensity, profile.color)
		})
	}

	for (let index = 0; index < fragmentCount; index++) {
		spawnDeathFragment(pos, effectIntensity, index, fragmentCount, profile.color)
	}
	for (let index = 0; spawnWreckage && index < wreckageCount; index++) {
		spawnShipWreckage(
			pos,
			wreckageIntensity,
			normalizedWreckageSize,
			index,
			wreckageCount
		)
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
			wreckageMultiplier: 1.6,
		}
	}
	if (tier === "elite") {
		return {
			color: k.rgb(70, 205, 255),
			fragmentMultiplier: 1.35,
			particleMultiplier: 1.25,
			burstCount: 2,
			shake: 2.2,
			wreckageMultiplier: 1.25,
		}
	}
	return {
		color: k.WHITE,
		fragmentMultiplier: 1,
		particleMultiplier: 1,
		burstCount: 1,
		shake: 0.28,
		wreckageMultiplier: 1,
	}
}

function spawnShipWreckage(
	pos: Vec2,
	intensity: number,
	normalizedSize: number,
	index: number,
	pieceCount: number
) {
	const direction = k.Vec2.fromAngle(
		(index / Math.max(1, pieceCount)) * 360 + k.rand(-32, 32)
	)
	const sizeMultiplier = k.lerp(0.62, 1.85, normalizedSize)
	const lifetime = k.rand(MIN_WRECKAGE_LIFETIME, MAX_WRECKAGE_LIFETIME)
	const initialScale = k.rand(0.42, 0.78) * sizeMultiplier
	const drift = k.vec2(k.rand(-3, 3), k.rand(-5, 2))
	const wreckage = k.add([
		k.pos(pos.add(direction.scale(k.rand(2, 9) * intensity))),
		k.sprite(k.choose(SHIP_WRECKAGE_SPRITES)),
		k.anchor("center"),
		k.rotate(k.rand(0, 360)),
		k.scale(initialScale),
		k.color(k.WHITE),
		k.opacity(1),
		k.layer(layers.gameEffects),
		k.z(-1),
		k.offscreen({ destroy: true, distance: 220 }),
		k.lifespan(lifetime, { fade: k.rand(1.1, 1.7) }),
		{
			velocity: direction.scale(k.rand(18, 44) * k.lerp(0.8, 1.25, normalizedSize)),
			drift,
			angularVelocity: k.rand(-135, 135),
			initialScale,
			elapsed: 0,
			lifetime,
		},
		tags.props,
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", wreckage, () => {
		wreckage.elapsed += k.dt()
		wreckage.velocity = wreckage.velocity
			.add(wreckage.drift.scale(k.dt()))
			.scale(Math.pow(0.988, k.dt() * 60))
		wreckage.pos = wreckage.pos.add(wreckage.velocity.scale(k.dt()))
		wreckage.angle += wreckage.angularVelocity * k.dt()
		wreckage.angularVelocity *= Math.pow(0.992, k.dt() * 60)
		const progress = k.clamp(wreckage.elapsed / wreckage.lifetime, 0, 1)
		wreckage.scale = k.vec2(
			wreckage.initialScale * k.lerp(1, 0.88, progress)
		)
	})
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
