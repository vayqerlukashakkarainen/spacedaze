import type { GameObj, ParticlesComp, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { spawnExplosionEffect } from "../spawn/spawnFlash"
import { tags } from "../tags"
import { applyDamage } from "./damageService"
import { registerBatchedEntityUpdate } from "./entityUpdateService"

const HEAVY_DAMAGE_THRESHOLD = 0.5
const PART_SMOKE_INTERVAL = [0.46, 0.08] as const
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

const damageSmokeEmitters: Array<SmokeEmitter | undefined> = []
const explosionSmokeEmitters: Array<SmokeEmitter | undefined> = []

export function startShipPartDamageSmoke(part: GameObj, body: GameObj) {
	if (part.shipPartDamageSmokeTracked) return
	part.shipPartDamageSmokeTracked = true
	let smokeTimer = 0

	registerBatchedEntityUpdate("effects", part, () => {
		if (
			part.hidden ||
			typeof part.hp !== "number" ||
			typeof part.maxHP !== "number" ||
			part.maxHP <= 0
		) return
		const healthRatio = k.clamp(part.hp / part.maxHP, 0, 1)
		const intensity = k.clamp(
			(HEAVY_DAMAGE_THRESHOLD - healthRatio) / HEAVY_DAMAGE_THRESHOLD,
			0,
			1
		)
		if (intensity <= 0) {
			smokeTimer = 0
			return
		}

		smokeTimer -= k.dt() * getObjectTimescale(part)
		if (smokeTimer > 0) return
		const explosionRadius = getPartExplosionRadius(body)
		const emitter = getDamageSmokeEmitter(explosionRadius)
		const position = getWorldPosition(part).add(
			k.rand(-2.5, 2.5),
			k.rand(-2.5, 1)
		)
		emitter.emitter.position = position
		emitter.emit(1 + Math.floor(intensity * 2))
		smokeTimer = k.lerp(
			PART_SMOKE_INTERVAL[0],
			PART_SMOKE_INTERVAL[1],
			intensity
		)
	})
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
	const excludedIds = new Set([part.id, ...(options.excludeIds ?? [])])

	spawnExplosionEffect(position, radius * 0.72, {
		ringIntensity: 0.42,
		particleCount: 12,
	})
	emitPartExplosionSmoke(position, radius)
	k.shake(k.clamp(radius / 18, 1.8, 4))

	const targets = k.get("*", { recursive: true }) as GameObj[]
	for (const target of targets) {
		if (
			!target.exists() ||
			excludedIds.has(target.id) ||
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
		})
	}
}

function getDamageSmokeEmitter(explosionRadius: number) {
	const profileIndex = getSmokeProfileIndex(explosionRadius)
	const existing = damageSmokeEmitters[profileIndex]
	if (existing?.exists()) return existing
	const scale = SMOKE_SCALE_PROFILES[profileIndex]
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
	damageSmokeEmitters[profileIndex] = emitter
	return emitter
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

function getObjectTimescale(target: GameObj) {
	return typeof target.getTimescale === "function" ? target.getTimescale() : 1
}
