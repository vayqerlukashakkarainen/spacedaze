import type { GameObj, Vec2 } from "kaplay"
import { k, mainSoundVolume } from "../main"
import { player } from "../player"
import { resolveCriticalDamage } from "../projectiles/shared"
import { spawnExplosionEffect, spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"
import { applyDamage } from "./damageService"
import { applyExplosionPulse } from "./explosionPulseService"
import { audioService } from "./audioService"
import { querySpatialNearby } from "./runtimeSpatialIndexService"

export interface ExplosionOptions {
	pos: Vec2
	radius: number
	damage: number
	visualScale?: number
	visualIntensity?: number
	visualParticleCount?: number
	damageFalloff?: number
	falloffDistance?: number
	canCrit?: boolean
	targets?: GameObj[]
	onResolved?: (explosion: ExplosionContext) => void
}

export interface ExplosionHit {
	target: GameObj
	damage: number
	critical: boolean
}

export interface ExplosionContext extends ExplosionOptions {
	targets: GameObj[]
	hits: ExplosionHit[]
}

export type ExplosionModifier = (explosion: ExplosionContext) => void

const explosionModifiers = new Set<ExplosionModifier>()

export function registerExplosionModifier(modifier: ExplosionModifier) {
	explosionModifiers.add(modifier)
	return () => explosionModifiers.delete(modifier)
}

export function createExplosion(options: ExplosionOptions) {
	const suppliedTargets = options.targets
	const context: ExplosionContext = {
		...options,
		pos: options.pos.clone(),
		hits: [],
		targets: suppliedTargets ?? [],
	}
	for (const modifier of explosionModifiers) modifier(context)
	if (!suppliedTargets) {
		context.targets = querySpatialNearby(context.pos, context.radius, {
			allTags: [tags.enemy, tags.unit],
		})
	}

	spawnExplosionEffect(
		context.pos,
		context.radius * (context.visualScale ?? 1),
		{
			ringIntensity: context.visualIntensity,
			particleCount: context.visualParticleCount,
		}
	)
	applyPlayerExplosionPulse(context)
	let playedCritSound = false

	for (const target of context.targets) {
		if (!target.exists() || !target.pos || target.pos.dist(context.pos) >= context.radius) {
			continue
		}
		const result = context.canCrit === false
			? { damage: context.damage, critical: false }
			: resolveCriticalDamage(
				player.critChance,
				context.damage,
				player.critMultiplier
			)
		if (!applyDamage(target, result.damage, { critical: result.critical })) continue
		context.hits.push({
			target,
			damage: result.damage,
			critical: result.critical,
		})

		if (result.critical) {
			spawnFlash(target.pos, 1.5, k.RED)
			if (!playedCritSound) {
				audioService.playPositionalSound("crit1", context.pos, {
					volume: mainSoundVolume,
				})
				playedCritSound = true
			}
		}
	}
	context.onResolved?.(context)

	return context
}

function applyPlayerExplosionPulse(context: ExplosionContext) {
	if (player.explosionPulseStrength <= 0) return
	const pulseRadius = context.radius * 1.5
	applyExplosionPulse(
		context.targets,
		context.pos,
		pulseRadius,
		player.explosionPulseStrength
	)
	spawnRing({
		pos: context.pos,
		speed: 260,
		intensity: 0.25,
		maxRadius: pulseRadius,
		visualize: true,
		color: k.rgb(80, 170, 255),
	})
}
