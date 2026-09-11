import type { Color, GameObj, PosComp, Vec2 } from "kaplay"
import { k, mainSoundVolume } from "../../main"
import { player } from "../../player"
import { resolveCriticalDamage } from "../../projectiles/shared"
import {
	spawnExplosionEffect,
	spawnExplosiveBarrelExplosionEffect,
	spawnFlash,
} from "../../spawn/spawnFlash"
import { spawnRing } from "../../spawn/spawnRing"
import { tags } from "../../tags"
import { applyDamage } from "./damageService"
import {
	applyDefaultExplosionForce,
	applyExplosionForce,
	applyExplosionPulse,
} from "./explosionPulseService"
import { audioService } from "../audio/audioService"
import { querySpatialNearby } from "../core/runtimeSpatialIndexService"
import type { CombatCredit } from "../progression/combatCredit"
import { damageDestructibleWallsInRadius } from "../world/destructibleWallService"

export interface ExplosionOptions {
	pos: Vec2
	radius: number
	damage: number
	visualColor?: Color
	visualScale?: number
	visualIntensity?: number
	visualParticleCount?: number
	visualStyle?: "default" | "explosiveBarrel"
	persistentSmoke?: boolean
	damageFalloff?: number
	falloffDistance?: number
	forceStrength?: number
	forceRadius?: number
	suppressForce?: boolean
	forceExcludeIds?: readonly number[]
	canCrit?: boolean
	targets?: GameObj[]
	onResolved?: (explosion: ExplosionContext) => void
	combatCredit?: CombatCredit
}

export interface ExplosionHit {
	target: GameObj<PosComp>
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
	if (player.glassReactor !== undefined) context.damage *= 2
	for (const modifier of explosionModifiers) modifier(context)
	if (!suppliedTargets) {
		context.targets = querySpatialNearby(context.pos, context.radius, {
			allTags: [tags.enemy, tags.unit],
		})
	}

	if (context.visualStyle === "explosiveBarrel") {
		spawnExplosiveBarrelExplosionEffect(context.pos, context.radius)
	} else {
		spawnExplosionEffect(
			context.pos,
			context.radius * (context.visualScale ?? 1),
			{
				ringIntensity: context.visualIntensity,
				particleCount: context.visualParticleCount,
				color: context.visualColor,
				persistentSmoke: context.persistentSmoke,
			}
		)
	}
	if (context.combatCredit?.explosive === true) {
		damageDestructibleWallsInRadius(
			context.pos,
			context.radius,
			context.damage,
			{ explosive: true }
		)
	}
	let playedCritSound = false

	for (const target of context.targets) {
		if (
			!target.exists() ||
			!hasPosition(target) ||
			target.pos.dist(context.pos) >= context.radius
		) {
			continue
		}
		const result = context.canCrit === false
			? { damage: context.damage, critical: false }
			: resolveCriticalDamage(
				player.critChance,
				context.damage,
				player.critMultiplier
			)
		if (!applyDamage(target, result.damage, {
			critical: result.critical,
			visualForceOrigin: context.pos,
			combatCredit: context.combatCredit,
		})) continue
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
	applyPlayerExplosionPulse(context)
	if (!context.suppressForce) {
		if (context.forceStrength === undefined && context.forceRadius === undefined) {
			applyDefaultExplosionForce(context.pos, context.radius, {
				excludeIds: context.forceExcludeIds,
			})
		} else {
			applyExplosionForce(
				context.pos,
				context.forceRadius ?? context.radius * 1.15,
				context.forceStrength ?? k.clamp(context.radius * 1.35, 48, 190),
				{ excludeIds: context.forceExcludeIds }
			)
		}
	}
	context.onResolved?.(context)

	return context
}

function hasPosition(target: GameObj): target is GameObj<PosComp> {
	return target.pos !== undefined && typeof target.pos?.dist === "function"
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
