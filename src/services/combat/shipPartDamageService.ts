import type { GameObj, ParticlesComp, PosComp, Vec2 } from "kaplay"
import { k, layers, subSoundVolume } from "../../main"
import { spawnExplosionEffect } from "../../spawn/spawnFlash"
import { tags } from "../../tags"
import { applyDamage, getLastCombatCredit } from "./damageService"
import { startMechanicalDamageSmoke } from "./enemyDamageEffectService"
import { gameSoundService } from "../audio/gameSoundService"
import { applyDefaultExplosionForce } from "./explosionPulseService"

const MIN_EXPLOSION_RADIUS = 34
const MAX_EXPLOSION_RADIUS = 72
const PART_EXPLOSION_DAMAGE_MULTIPLIER = 0.55
const SMOKE_SCALE_PROFILES = [0.7, 1, 1.45] as const

interface PartExplosionOptions {
	radius?: number
	damage?: number
	excludeIds?: readonly number[]
}

type SmokeEmitter = GameObj<PosComp | ParticlesComp>

const explosionSmokeEmitters: Array<SmokeEmitter | undefined> = []

export function startShipPartDamageSmoke(part: GameObj, body: GameObj) {
	startMechanicalDamageSmoke(part, body)
}

export function triggerShipPartExplosion(
	part: GameObj,
	body: GameObj,
	position: Vec2,
	options: PartExplosionOptions = {}
) {
	const radius = getPartExplosionRadius(body, options.radius)
	const partMaxHealth = typeof part.maxHP === "number" ? part.maxHP : 1
	const baseDamage = options.damage ?? Math.max(
		1,
		partMaxHealth * PART_EXPLOSION_DAMAGE_MULTIPLIER
	)
	const excludeIds = new Set([part.id, ...(options.excludeIds ?? [])])
	const partCredit = getLastCombatCredit(part)

	spawnExplosionEffect(position, radius * 0.72, {
		ringIntensity: 0.42,
		particleCount: 12,
	})
	emitPartExplosionSmoke(position, radius)
	gameSoundService.playPositional("ship_part_destroyed", position, {
		volume: subSoundVolume * k.lerp(
			0.55,
			0.85,
			getExplosionScaleProgress(radius)
		),
		minDistance: 70,
		maxDistance: 680,
		voiceLimit: 5,
	})
	k.shake(k.clamp(radius / 18, 1.8, 4))

	const targets = k.get("*", { recursive: true }) as GameObj[]
	for (const target of targets) {
		if (
			!target.exists() ||
			excludeIds.has(target.id) ||
			target.hidden ||
			typeof target.hp !== "number" ||
			target.hp <= 0 ||
			!target.is(tags.gameLoop)
		) continue
		const targetPosition = getWorldPosition(target)
		const distance = targetPosition.dist(position)
		if (distance >= radius) continue
		const damageMultiplier = k.lerp(1, 0.3, distance / radius)
		applyDamage(target, baseDamage * damageMultiplier, {
			position: position.clone(),
			visualForceOrigin: position.clone(),
			combatCredit: partCredit
				? { ...partCredit, explosive: true }
				: undefined,
		})
	}
	applyDefaultExplosionForce(position, radius, { excludeIds })
}

function emitPartExplosionSmoke(position: Vec2, explosionRadius: number) {
	const emitter = getExplosionSmokeEmitter(explosionRadius)
	const count = Math.round(k.lerp(
		4,
		10,
		getExplosionScaleProgress(explosionRadius)
	))
	const scatter = explosionRadius * 0.16
	for (let index = 0; index < count; index++) {
		emitter.emitter.position = position.add(
			k.rand(k.vec2(-scatter, -scatter), k.vec2(scatter, scatter))
		)
		emitter.emit(1)
	}
}

function getExplosionSmokeEmitter(explosionRadius: number) {
	const profileIndex = getSmokeProfileIndex(explosionRadius)
	const existing = explosionSmokeEmitters[profileIndex]
	if (existing?.exists()) return existing
	const scale = SMOKE_SCALE_PROFILES[profileIndex]
	const emitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 120,
				speed: [2, 9],
				angle: [0, 360],
				lifeTime: [3.5, 8],
				colors: [k.rgb(150, 150, 150), k.rgb(68, 68, 68)],
				opacities: [0.46, 0.36, 0.22, 0],
				scales: [3.2 * scale],
				damping: [0.15, 0.45],
				angularVelocity: [-8, 8],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(-2),
		tags.gameLoop,
	])
	explosionSmokeEmitters[profileIndex] = emitter
	return emitter
}

function getPartExplosionRadius(body: GameObj, override?: number) {
	if (override !== undefined) return override
	const bodyHitbox = typeof body.hb === "number" ? body.hb : 16
	return k.clamp(
		bodyHitbox * 2.25,
		MIN_EXPLOSION_RADIUS,
		MAX_EXPLOSION_RADIUS
	)
}

function getExplosionScaleProgress(explosionRadius: number) {
	return k.clamp(
		(explosionRadius - MIN_EXPLOSION_RADIUS) /
			(MAX_EXPLOSION_RADIUS - MIN_EXPLOSION_RADIUS),
		0,
		1
	)
}

function getSmokeProfileIndex(explosionRadius: number) {
	const progress = getExplosionScaleProgress(explosionRadius)
	if (progress < 0.34) return 0
	if (progress < 0.67) return 1
	return 2
}

function getWorldPosition(target: GameObj) {
	return target.worldPos?.clone() ?? target.pos.clone()
}
