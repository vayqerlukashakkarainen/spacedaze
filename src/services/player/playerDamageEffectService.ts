import type { GameObj } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"

const PLAYER_DAMAGE_EFFECT_THRESHOLD = 0.7
const SMOKE_INTERVAL = [0.5, 0.07] as const
const SPARK_INTERVAL = [1.1, 0.14] as const
const SHAKE_INTERVAL_AT_THRESHOLD = [2.4, 4.8] as const
const SHAKE_INTERVAL_NEAR_DEATH = [0.45, 1.25] as const
const SHAKE_DURATION = [0.08, 0.2] as const
const SHAKE_STRENGTH = [0.45, 1.8] as const
const SHAKE_ANGLE = [0.8, 3.2] as const

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
	const damageSparkEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 96,
				speed: [70, 130],
				lifeTime: [0.35, 0.75],
				angle: [0, 360],
				colors: [
					k.rgb(255, 190, 70),
					k.rgb(255, 105, 35),
				],
				opacities: [1, 0.72, 0],
				scales: [1, 0.7, 0.2],
				damping: [0.5, 1.5],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 90,
				spread: 70,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(5),
		tags.gameLoop,
	])
	let smokeTimer = 0
	let sparkTimer = 0
	let shakeTimer = nextDamageShakeDelay(0)
	let shakeElapsed = 0
	let shakeDuration = 0
	let shakeStrength = 0
	let shakeAngleStrength = 0
	let shakeOscillations = 0
	let shakeDirection = k.vec2(0, 0)
	let shakeOffset = k.vec2(0, 0)
	let shakeAngle = 0
	const hullVisual = playerObj.playerHullVisual as GameObj | undefined
	if (hullVisual?.exists()) {
		hullVisual.onUpdate(() => {
			hullVisual.pos = shakeOffset
			hullVisual.angle += shakeAngle
		})
	}

	playerObj.onUpdate(() => {
		const intensity = getPlayerDamageEffectIntensity(
			playerObj.hp,
			playerObj.maxHP
		)
		if (intensity <= 0 || playerObj.opacity < 0.5) {
			smokeTimer = 0
			sparkTimer = 0
			shakeTimer = nextDamageShakeDelay(0)
			shakeElapsed = 0
			shakeDuration = 0
			shakeOffset = k.vec2(0, 0)
			shakeAngle = 0
			return
		}
		updateDamageShake(intensity)

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
			damageSparkEmitter.emitter.position = damagePos
			damageSparkEmitter.emitter.direction = playerObj.angle + 90
			damageSparkEmitter.emit(1 + Math.floor(intensity * 3))
			sparkTimer = k.lerp(SPARK_INTERVAL[0], SPARK_INTERVAL[1], intensity)
		}
	})

	playerObj.onDestroy(() => {
		if (smokeEmitter.exists()) k.destroy(smokeEmitter)
		if (damageSparkEmitter.exists()) k.destroy(damageSparkEmitter)
	})

	function updateDamageShake(intensity: number) {
		if (shakeElapsed < shakeDuration) {
			shakeElapsed = Math.min(shakeDuration, shakeElapsed + k.dt())
			const progress = shakeElapsed / shakeDuration
			const envelope = 1 - progress
			const rattle = 0.72 +
				Math.sin(progress * Math.PI * shakeOscillations) * 0.28
			shakeOffset = shakeDirection.scale(shakeStrength * envelope * rattle)
			shakeAngle = shakeAngleStrength * envelope * rattle
			return
		}

		shakeOffset = k.vec2(0, 0)
		shakeAngle = 0
		shakeTimer -= k.dt()
		if (shakeTimer > 0) return

		shakeElapsed = 0
		shakeDuration = k.rand(SHAKE_DURATION[0], SHAKE_DURATION[1])
		shakeStrength = k.lerp(
			SHAKE_STRENGTH[0],
			SHAKE_STRENGTH[1],
			intensity
		) * k.rand(0.72, 1.18)
		shakeAngleStrength = k.lerp(
			SHAKE_ANGLE[0],
			SHAKE_ANGLE[1],
			intensity
		) * k.rand(-1, 1)
		shakeOscillations = k.rand(1.4, 3.2)
		shakeDirection = k.Vec2.fromAngle(k.rand(0, 360))
		shakeTimer = nextDamageShakeDelay(intensity)
	}
}

function nextDamageShakeDelay(intensity: number) {
	const minimum = k.lerp(
		SHAKE_INTERVAL_AT_THRESHOLD[0],
		SHAKE_INTERVAL_NEAR_DEATH[0],
		intensity
	)
	const maximum = k.lerp(
		SHAKE_INTERVAL_AT_THRESHOLD[1],
		SHAKE_INTERVAL_NEAR_DEATH[1],
		intensity
	)
	return k.rand(minimum, maximum)
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
