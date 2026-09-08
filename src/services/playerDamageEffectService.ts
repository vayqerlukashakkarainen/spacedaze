import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import { sparkEmitter } from "../particles"
import { tags } from "../tags"

const PLAYER_DAMAGE_EFFECT_THRESHOLD = 0.3
const SMOKE_INTERVAL = [0.5, 0.07] as const
const SPARK_INTERVAL = [1.1, 0.14] as const

export function addPlayerDamageEffects(playerObj: GameObj) {
	const smokeEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 120,
				speed: [6, 24],
				lifeTime: [0.45, 1.1],
				colors: [k.rgb(220, 225, 230), k.rgb(72, 80, 88)],
				opacities: [0, 0.72, 0.42, 0],
				scales: [0.4, 1.2, 1.8],
				damping: [1, 2],
				angularVelocity: [-55, 55],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 90,
				spread: 70,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(4),
		tags.gameLoop,
	])
	let smokeTimer = 0
	let sparkTimer = 0

	playerObj.onUpdate(() => {
		const intensity = getPlayerDamageEffectIntensity(
			playerObj.hp,
			playerObj.maxHP
		)
		if (intensity <= 0 || playerObj.opacity < 0.5) {
			smokeTimer = 0
			sparkTimer = 0
			return
		}

		const damagePos = getDamageEffectPosition(playerObj)
		smokeTimer -= k.dt()
		if (smokeTimer <= 0) {
			smokeEmitter.emitter.position = damagePos
			smokeEmitter.emitter.direction = playerObj.angle + 90
			smokeEmitter.emit(1 + Math.floor(intensity * 2))
			smokeTimer = k.lerp(SMOKE_INTERVAL[0], SMOKE_INTERVAL[1], intensity)
		}

		sparkTimer -= k.dt()
		if (sparkTimer <= 0) {
			sparkEmitter.emitter.position = damagePos
			sparkEmitter.emitter.direction = playerObj.angle + 90
			sparkEmitter.emit(1 + Math.floor(intensity * 3))
			sparkTimer = k.lerp(SPARK_INTERVAL[0], SPARK_INTERVAL[1], intensity)
		}
	})

	playerObj.onDestroy(() => {
		if (smokeEmitter.exists()) k.destroy(smokeEmitter)
	})
}

export function getPlayerDamageEffectIntensity(health: number, maxHealth: number) {
	if (maxHealth <= 0) return 0
	const healthRatio = k.clamp(health / maxHealth, 0, 1)
	return k.clamp(
		(PLAYER_DAMAGE_EFFECT_THRESHOLD - healthRatio) /
			PLAYER_DAMAGE_EFFECT_THRESHOLD,
		0,
		1
	)
}

function getDamageEffectPosition(playerObj: GameObj) {
	const rearOffset = k.Vec2.fromAngle(playerObj.angle + 90).scale(3)
	return playerObj.pos.add(rearOffset).add(
		k.rand(-4, 4),
		k.rand(-4, 4)
	)
}
