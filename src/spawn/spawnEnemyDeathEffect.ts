import type { Vec2 } from "kaplay"
import { k, layers } from "../main"
import { explosionEmitter } from "../particles"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { tags } from "../tags"
import { spawnExplosionEffect, spawnFlash } from "./spawnFlash"

const FRAGMENT_SPRITES = [
	"debree_part1",
	"particle1",
	"particle2",
	"particle3",
	"particle4",
] as const

export function spawnEnemyDeathEffect(pos: Vec2, intensity: number = 1) {
	const effectIntensity = k.clamp(intensity, 0.35, 1.45)
	const normalizedIntensity = (effectIntensity - 0.35) / 1.1
	const fragmentCount = Math.round(k.lerp(4, 14, normalizedIntensity))

	spawnExplosionEffect(pos, 13 * effectIntensity, {
		ringIntensity: 0.24,
		particleCount: Math.round(18 * effectIntensity),
	})
	spawnFlash(pos, 5 * effectIntensity)

	k.wait(0.055, () => {
		const direction = k.Vec2.fromAngle(k.rand(0, 360))
		const burstPos = pos.add(direction.scale(k.rand(4, 9) * effectIntensity))
		explosionEmitter.emitter.position = burstPos
		explosionEmitter.emit(Math.round(7 * effectIntensity))
		spawnFlash(burstPos, 3.5 * effectIntensity)
	})

	for (let index = 0; index < fragmentCount; index++) {
		spawnDeathFragment(pos, effectIntensity, index)
	}
}

function spawnDeathFragment(pos: Vec2, intensity: number, index: number) {
	const direction = k.Vec2.fromAngle(
		(index / 11) * 360 + k.rand(-18, 18)
	)
	const speed = k.rand(38, 92) * intensity
	const lifetime = k.rand(0.65, 1.15)
	const fragment = k.add([
		k.pos(pos.add(direction.scale(k.rand(1, 5)))),
		k.sprite(k.choose(FRAGMENT_SPRITES)),
		k.anchor("center"),
		k.rotate(k.rand(0, 360)),
		k.scale(k.rand(0.32, 0.72) * intensity),
		k.color(k.WHITE),
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
