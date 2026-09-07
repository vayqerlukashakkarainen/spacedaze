import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"

interface EnemyProjectileImpactOptions {
	position: Vec2
	direction: Vec2
	damage: number
	critical: boolean
	piercing: boolean
	splash: boolean
	knockback: number
}

const HIT_TINT_DURATION = 0.065
const NORMAL_HIT_TINT = [120, 220, 255] as const
const CRITICAL_HIT_TINT = [255, 92, 92] as const

export function applyEnemyProjectileImpact(
	target: GameObj,
	options: EnemyProjectileImpactOptions
) {
	if (!target.exists() || !target.tags.includes(tags.enemy)) return
	const direction = options.direction.len() > 0.001
		? options.direction.unit()
		: target.pos.sub(options.position).unit()
	const color = options.critical
		? k.rgb(...CRITICAL_HIT_TINT)
		: k.rgb(...NORMAL_HIT_TINT)
	const flashSize = k.clamp(3.5 + Math.sqrt(options.damage) * 1.2, 4, 8)

	spawnFlash(options.position, flashSize, color)
	spawnImpactSpark(options.position, direction, color, options.critical)
	if (options.piercing) {
		spawnRing({
			pos: options.position,
			speed: 170,
			intensity: options.critical ? 0.42 : 0.28,
			maxRadius: flashSize * 2.4,
			visualize: true,
			color,
		})
	}

	applyEnemyHitTint(target, color)
	applyEnemyHitRecoil(target, direction, options)
	applyWeaponImpactShake(options)
}

function spawnImpactSpark(
	position: Vec2,
	direction: Vec2,
	color: Color,
	critical: boolean
) {
	const angle = direction.len() > 0.001 ? direction.angle() : 0
	const length = critical ? 13 : 9
	for (const offset of [-22, 22]) {
		k.add([
			k.pos(position),
			k.rect(length, 1),
			k.anchor("center"),
			k.rotate(angle + offset),
			k.color(color),
			k.opacity(1),
			k.layer(layers.gameEffects),
			k.lifespan(critical ? 0.09 : 0.065, { fade: 0.045 }),
			tags.gameLoop,
		])
	}
}

function applyEnemyHitTint(target: GameObj, tint: Color) {
	if (!target.color) return
	const token = (target.combatHitTintToken ?? 0) + 1
	const original = k.rgb(target.color.r, target.color.g, target.color.b)
	target.combatHitTintToken = token
	target.color = tint
	k.wait(HIT_TINT_DURATION, () => {
		if (!target.exists() || target.combatHitTintToken !== token) return
		target.color = original
	})
}

function applyEnemyHitRecoil(
	target: GameObj,
	direction: Vec2,
	options: EnemyProjectileImpactOptions
) {
	if (!target.pos || direction.len() <= 0.001 || options.knockback > 0) return
	const resistance = target.tags.includes(tags.boss)
		? 0.12
		: target.tags.includes(tags.elite)
			? 0.45
			: 1
	const distance = k.clamp(Math.sqrt(options.damage) * 0.8, 0.5, 2.25)
	target.pos = target.pos.add(direction.scale(distance * resistance))
}

function applyWeaponImpactShake(options: EnemyProjectileImpactOptions) {
	const damageWeight = k.clamp((Math.sqrt(options.damage) - 0.55) * 0.38, 0.06, 1.25)
	const criticalWeight = options.critical ? 0.55 : 0
	const splashWeight = options.splash ? 0.32 : 0
	const knockbackWeight = k.clamp(options.knockback / 90, 0, 0.75)
	const piercingWeight = options.piercing ? 0.12 : 0
	k.shake(k.clamp(
		damageWeight + criticalWeight + splashWeight + knockbackWeight + piercingWeight,
		0.06,
		2.6
	))
}
