import type { GameObj, ParticlesComp, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"

export type EnemyDamageMaterial = "mechanical" | "rock" | "flesh"

const MECHANICAL_DAMAGE_THRESHOLD = 0.5
const MECHANICAL_SMOKE_INTERVAL = [0.46, 0.08] as const
const MECHANICAL_SMOKE_SCALE_PROFILES = [0.7, 1, 1.45] as const
const FLESH_DAMAGE_THRESHOLD = 0.5
const FLESH_BLEED_INTERVAL = [0.55, 0.1] as const
const MIN_EFFECT_RADIUS = 34
const MAX_EFFECT_RADIUS = 72

type DamageEmitter = GameObj<PosComp | ParticlesComp>

const mechanicalSmokeEmitters: Array<DamageEmitter | undefined> = []
let bleedEmitter: DamageEmitter | undefined

export function startMechanicalDamageSmoke(
	target: GameObj,
	scaleSource: GameObj = target
) {
	if (target.mechanicalDamageSmokeTracked) return
	target.mechanicalDamageSmokeTracked = true
	let smokeTimer = 0

	registerBatchedEntityUpdate("effects", target, () => {
		if (
			target.hidden ||
			typeof target.hp !== "number" ||
			typeof target.maxHP !== "number" ||
			target.maxHP <= 0
		) return
		const healthRatio = k.clamp(target.hp / target.maxHP, 0, 1)
		const intensity = k.clamp(
			(MECHANICAL_DAMAGE_THRESHOLD - healthRatio) /
				MECHANICAL_DAMAGE_THRESHOLD,
			0,
			1
		)
		if (intensity <= 0) {
			smokeTimer = 0
			return
		}

		smokeTimer -= k.dt() * getObjectTimescale(target)
		if (smokeTimer > 0) return
		const emitter = getMechanicalSmokeEmitter(scaleSource)
		emitter.emitter.position = getWorldPosition(target).add(
			k.rand(-2.5, 2.5),
			k.rand(-2.5, 1)
		)
		emitter.emit(1 + Math.floor(intensity * 2))
		smokeTimer = k.lerp(
			MECHANICAL_SMOKE_INTERVAL[0],
			MECHANICAL_SMOKE_INTERVAL[1],
			intensity
		)
	})
}

export function emitMechanicalDamageSmokeBurst(
	position: Vec2,
	scaleSource: GameObj,
	count: number
) {
	const emitter = getMechanicalSmokeEmitter(scaleSource)
	const spread = k.clamp((scaleSource.hb ?? 16) * 0.18, 2, 7)
	for (let index = 0; index < count; index++) {
		emitter.emitter.position = position.add(
			k.rand(-spread, spread),
			k.rand(-spread, spread)
		)
		emitter.emit(1)
	}
}

export function emitMechanicalAccelerationSmoke(
	position: Vec2,
	scaleSource: GameObj,
	direction: number,
	count: number = 1
) {
	const emitter = getMechanicalSmokeEmitter(scaleSource)
	const previousDirection = emitter.emitter.direction
	emitter.emitter.position = position
	emitter.emitter.direction = direction
	emitter.emit(count)
	emitter.emitter.direction = previousDirection
}

export function ensureEnemyLowHealthEffects(enemy: GameObj) {
	if (enemy.enemyLowHealthEffectsTracked) return
	enemy.enemyLowHealthEffectsTracked = true
	const material = getEnemyDamageMaterial(enemy)
	enemy.enemyDamageMaterial = material

	if (material === "mechanical") {
		startMechanicalDamageSmoke(enemy)
		return
	}
	if (material === "flesh") startFleshBleeding(enemy)
}

export function getEnemyDamageMaterial(enemy: GameObj): EnemyDamageMaterial {
	const material = enemy.enemyDamageMaterial
	if (
		material === "mechanical" ||
		material === "rock" ||
		material === "flesh"
	) return material
	return "mechanical"
}

function startFleshBleeding(enemy: GameObj) {
	let bleedTimer = 0
	registerBatchedEntityUpdate("effects", enemy, () => {
		if (
			enemy.hidden ||
			typeof enemy.hp !== "number" ||
			typeof enemy.maxHP !== "number" ||
			enemy.maxHP <= 0
		) return
		const healthRatio = k.clamp(enemy.hp / enemy.maxHP, 0, 1)
		const intensity = k.clamp(
			(FLESH_DAMAGE_THRESHOLD - healthRatio) / FLESH_DAMAGE_THRESHOLD,
			0,
			1
		)
		if (intensity <= 0) {
			bleedTimer = 0
			return
		}

		bleedTimer -= k.dt() * getObjectTimescale(enemy)
		if (bleedTimer > 0) return
		const emitter = getBleedEmitter()
		const position = getWorldPosition(enemy)
		const spread = k.clamp((enemy.hb ?? 12) * 0.2, 2, 6)
		emitter.emitter.position = position.add(
			k.rand(-spread, spread),
			k.rand(-spread, spread)
		)
		emitter.emit(1 + Math.floor(intensity))
		bleedTimer = k.lerp(
			FLESH_BLEED_INTERVAL[0],
			FLESH_BLEED_INTERVAL[1],
			intensity
		)
	})
}

function getMechanicalSmokeEmitter(scaleSource: GameObj) {
	const sourceHitbox = typeof scaleSource.hb === "number" ? scaleSource.hb : 16
	const radius = k.clamp(
		sourceHitbox * 2.25,
		MIN_EFFECT_RADIUS,
		MAX_EFFECT_RADIUS
	)
	const progress = (radius - MIN_EFFECT_RADIUS) /
		(MAX_EFFECT_RADIUS - MIN_EFFECT_RADIUS)
	const profileIndex = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2
	const existing = mechanicalSmokeEmitters[profileIndex]
	if (existing?.exists()) return existing
	const scale = MECHANICAL_SMOKE_SCALE_PROFILES[profileIndex]
	const emitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 180,
				speed: [7, 24],
				acceleration: [k.vec2(-4, -18), k.vec2(4, -32)],
				angle: [0, 360],
				lifeTime: [0.5, 1.15],
				colors: [k.rgb(220, 225, 230), k.rgb(58, 64, 70)],
				opacities: [0, 0.7, 0.42, 0],
				scales: [0.35 * scale, 1.1 * scale, 1.9 * scale],
				angularVelocity: [-55, 55],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 65,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(4),
		tags.gameLoop,
	])
	mechanicalSmokeEmitters[profileIndex] = emitter
	return emitter
}

function getBleedEmitter() {
	if (bleedEmitter?.exists()) return bleedEmitter
	bleedEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 100,
				speed: [5, 18],
				angle: [0, 360],
				lifeTime: [0.28, 0.65],
				colors: [k.rgb(255, 72, 72), k.rgb(120, 18, 28)],
				opacities: [0.9, 0.65, 0],
				scales: [0.8, 0.45, 0.1],
				damping: [1, 2],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 90,
				spread: 360,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(3),
		tags.gameLoop,
	])
	return bleedEmitter
}

function getObjectTimescale(target: GameObj) {
	return typeof target.getTimescale === "function"
		? target.getTimescale()
		: 1
}

function getWorldPosition(target: GameObj) {
	return target.worldPos?.clone() ?? target.pos.clone()
}
