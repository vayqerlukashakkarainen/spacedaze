import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, layers, mainSoundVolume } from "../main"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { spawnProjectile } from "../services/combat/projectileService"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/enemies/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { spawnExplosionEffect } from "./spawnFlash"
import { setHitSoundProfile } from "../services/audio/hitSoundService"

const ATTACK_RANGE = 700
const VOLLEY_COOLDOWN = 4
const CANNONBALL_SPEED = 165
const CANNONBALL_SPREAD = 9
const DEATH_DURATION = 1
const DEATH_BURST_INTERVAL = 0.17
const PLATFORM_VISUAL = getEnemyVisual("stationary-cannon-platform")
const PLATFORM_SCALE = PLATFORM_VISUAL.worldScale

const CANNONS: readonly (readonly [number, number, number])[] = [
	[-36, 13, 135],
	[0, 35, 90],
	[37, 12, 45],
]

export function spawnStationaryCannonPlatform(
	pos: Vec2,
	depth: number = 1,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		14 + Math.max(0, depth - 1) * 3,
		1,
		PLATFORM_SCALE,
		options
	)
	const platform = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(PLATFORM_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		{
			hb: 42 * profile.scale,
			damage: profile.damage,
			attackTimer: k.rand(0.8, VOLLEY_COOLDOWN),
			deathAnimating: false,
			deathElapsed: 0,
			deathBurstTimer: 0,
			deathOrigin: pos.clone(),
			runtimeCullRadius: 64 * profile.scale,
			threatRank: ENEMY_THREAT_RANK.heavyVehicle,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleTerrain,
		tags.enemyRoleArtillery,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(platform, "heavyMetal")

	registerHitAnimation(platform)
	registerBatchedEntityUpdate("enemies", platform, () => {
		const delta = k.dt() * platform.getTimescale()
		if (platform.deathAnimating) {
			updateDeathAnimation(platform, delta, profile.rewardMultiplier, options.tags)
			return
		}

		const distance = platform.pos.dist(playerObj.pos)
		platform.attackTimer -= delta * (profile.elite ? 1.2 : 1)
		if (platform.attackTimer <= 0 && distance <= ATTACK_RANGE) {
			fireVolley(platform, profile.damage, profile.speedMultiplier, options.tags)
			platform.attackTimer = VOLLEY_COOLDOWN
		}

		checkProjectileIntersection(
			platform.pos,
			platform.hb,
			tags.friendly,
			(projectile) => onEnemyHit(platform, projectile)
		)
	})

	platform.onDeath(() => {
		if (platform.deathAnimating) return
		platform.deathAnimating = true
		platform.deathElapsed = 0
		platform.deathBurstTimer = 0
		platform.deathOrigin = platform.pos.clone()
		platform.color = k.rgb(215, 220, 222)
	})

	platform.onHurt(() => {
		if (platform.deathAnimating) return
		platform.animation.seek(0)
	})

	return platform
}

function fireVolley(
	platform: GameObj,
	damage: number,
	speedMultiplier: number,
	extraTags?: string[]
) {
	for (const [offsetX, offsetY, cannonAngle] of CANNONS) {
		const muzzleOffset = k.vec2(offsetX, offsetY)
		const muzzle = platform.pos.add(muzzleOffset.scale(platform.scale.x))
		for (const angleOffset of [-CANNONBALL_SPREAD, 0, CANNONBALL_SPREAD]) {
			const angle = cannonAngle + angleOffset
			const direction = k.Vec2.fromAngle(angle)
			spawnProjectile({
				pos: muzzle.clone(),
				dir: direction,
				rotation: angle + 90,
				sprite: "particle3",
				tint: k.rgb(215, 222, 226),
				effectTint: k.rgb(215, 222, 226),
				speed: CANNONBALL_SPEED,
				speedMultiplier,
				tags: [tags.enemy, tags.blaster, ...(extraTags ?? [])],
				impact: { damage },
				lifespan: { duration: 5.5 },
				damageSource: {
					name: "CANNON PLATFORM",
					sprite: "enemy_stationary_cannon_platform",
				},
			})
		}
	}
	gameSoundService.playPositional("fire_rocket1", platform.pos, {
		volume: mainSoundVolume * 0.7,
		detune: -180,
	})
	k.shake(1.5)
}

function updateDeathAnimation(
	platform: GameObj,
	delta: number,
	rewardMultiplier: number,
	extraTags?: string[]
) {
	platform.deathElapsed += delta
	platform.deathBurstTimer -= delta
	const progress = k.clamp(platform.deathElapsed / DEATH_DURATION, 0, 1)
	const shake = 1 + progress * 4
	platform.pos = platform.deathOrigin.add(
		k.vec2(k.rand(-shake, shake), k.rand(-shake, shake))
	)
	platform.angle = k.rand(-2, 2) * (1 + progress)

	if (platform.deathBurstTimer <= 0) {
		platform.deathBurstTimer = DEATH_BURST_INTERVAL * k.rand(0.72, 1.12)
		const burstPos = platform.deathOrigin.add(
			k.vec2(k.rand(-40, 40), k.rand(-34, 34)).scale(platform.scale.x)
		)
		spawnExplosionEffect(burstPos, 18 + progress * 16, {
			particleCount: 5 + Math.floor(progress * 5),
			ringIntensity: 0.25 + progress * 0.35,
		})
		k.shake(1 + progress * 2.5)
	}

	if (progress < 1) return
	const deathPos = platform.deathOrigin.clone()
	spawnDestroyedPlatform(deathPos, platform.scale.x, extraTags)
	spawnExplosionEffect(deathPos, 74, {
		particleCount: 38,
		ringIntensity: 1,
	})
	k.shake(9)
	enemyOnDeath(
		deathPos,
		14 * rewardMultiplier,
		2.2 * rewardMultiplier,
		"enemy",
		false,
		{ tier: platform.is(tags.elite) ? "elite" : "normal" }
	)
	k.destroy(platform)
}

function spawnDestroyedPlatform(
	pos: Vec2,
	scale: number,
	extraTags?: string[]
) {
	return k.add([
		k.pos(pos),
		k.sprite(PLATFORM_VISUAL.destroyedSprite ?? requirePrimaryVisualSprite(PLATFORM_VISUAL)),
		k.anchor("center"),
		k.scale(scale),
		k.color(126, 134, 138),
		k.layer(layers.game),
		k.z(-2),
		{ runtimeCullRadius: 64 * scale },
		tags.props,
		tags.runtimeCullable,
		tags.gameLoop,
		...(extraTags ?? []),
	])
}
