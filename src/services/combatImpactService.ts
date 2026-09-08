import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"
import { registerBatchedUiUpdate } from "./uiUpdateService"

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
const PLAYER_DAMAGE_INDICATOR_RADIUS = 58
const MAX_PLAYER_DAMAGE_INDICATORS = 4
const activePlayerDamageIndicators: GameObj[] = []

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

export function showPlayerDamageDirection(
	player: GameObj,
	damage: number,
	sourcePosition?: Vec2,
	incomingDirection?: Vec2
) {
	if (!player.exists() || !player.pos) return
	const direction = resolvePlayerDamageDirection(
		player.pos,
		sourcePosition,
		incomingDirection
	)
	if (!direction) return
	while (activePlayerDamageIndicators.length >= MAX_PLAYER_DAMAGE_INDICATORS) {
		const oldest = activePlayerDamageIndicators.shift()
		if (oldest?.exists()) k.destroy(oldest)
	}

	const duration = 0.42 + k.clamp(damage * 0.018, 0, 0.16)
	const indicator = k.add([
		k.pos(k.toScreen(player.pos).add(direction.scale(PLAYER_DAMAGE_INDICATOR_RADIUS))),
		k.polygon([
			k.vec2(-7, -6),
			k.vec2(8, 0),
			k.vec2(-7, 6),
		]),
		k.anchor("center"),
		k.rotate(direction.angle()),
		k.color(255, 70, 70),
		k.outline(1, k.WHITE),
		k.opacity(1),
		k.scale(1),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(120),
		{
			elapsed: 0,
			direction,
			duration,
		},
		tags.gameLoop,
	])
	activePlayerDamageIndicators.push(indicator)
	indicator.onDestroy(() => {
		const index = activePlayerDamageIndicators.findIndex(
			(candidate) => candidate.id === indicator.id
		)
		if (index >= 0) activePlayerDamageIndicators.splice(index, 1)
	})
	registerBatchedUiUpdate("overlay", indicator, () => {
		if (!player.exists()) {
			k.destroy(indicator)
			return
		}
		indicator.elapsed += k.dt()
		const progress = k.clamp(indicator.elapsed / indicator.duration, 0, 1)
		const pulse = progress < 0.18
			? k.lerp(0.72, 1.18, progress / 0.18)
			: k.lerp(1.18, 0.86, (progress - 0.18) / 0.82)
		indicator.pos = k.toScreen(player.pos).add(
			indicator.direction.scale(PLAYER_DAMAGE_INDICATOR_RADIUS + progress * 7)
		)
		indicator.scale = k.vec2(pulse)
		indicator.opacity = 1 - Math.pow(progress, 1.8)
		if (progress >= 1) k.destroy(indicator)
	})
}

function resolvePlayerDamageDirection(
	playerPosition: Vec2,
	sourcePosition?: Vec2,
	incomingDirection?: Vec2
) {
	if (incomingDirection && incomingDirection.len() > 0.001) {
		return incomingDirection.scale(-1).unit()
	}
	if (!sourcePosition) return undefined
	const direction = sourcePosition.sub(playerPosition)
	return direction.len() > 0.001 ? direction.unit() : undefined
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
	const original = target.combatHitBaseColor ?? k.rgb(
		target.color.r,
		target.color.g,
		target.color.b
	)
	target.combatHitBaseColor = original
	target.combatHitTintToken = token
	target.color = tint
	k.wait(HIT_TINT_DURATION, () => {
		if (!target.exists() || target.combatHitTintToken !== token) return
		target.color = original
		delete target.combatHitBaseColor
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
