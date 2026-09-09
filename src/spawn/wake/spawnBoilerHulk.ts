import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import { ASTEROID_SPRITES } from "../../asteroidSprites"
import { applyDamage } from "../../services/damageService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getEnemyNavigationDirection } from "../../services/enemyNavigationService"
import { spawnTargetTelegraph } from "../../services/enemyTelegraphService"
import { gameSoundService } from "../../services/gameSoundService"
import { setHitSoundProfile } from "../../services/hitSoundService"
import { isPlayerDamageInvulnerable } from "../../services/playerDamageState"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/threatService"
import {
	applyDirectionalSteeringLean,
	easeDirection,
	registerHitAnimation,
} from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { onEnemyHit } from "../enemyShared"
import { spawnExplosionEffect, spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const BOILER_HULK_VISUAL = getEnemyVisual("wake-boiler-hulk")
const HULK_IMPACT_RADIUS = 58
const SCRAP_SHIELD_CHARGE_DURATION = 2
const SCRAP_SHIELD_INITIAL_DELAY = 5.5
const SCRAP_SHIELD_COOLDOWN = 8
const SCRAP_SHIELD_COUNT = 8
const SCRAP_SHIELD_RADIUS = 62
const SCRAP_SHIELD_HITBOX = 11
const SCRAP_SHIELD_ORBIT_SPEED = 52
const PLAYER_HITBOX = 8

export interface BoilerHulkSpawnOptions extends EnemySpawnOptions {
	onDefeated?: () => void
}

export function spawnBoilerHulk(
	pos: Vec2,
	hp = 20,
	options: BoilerHulkSpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, BOILER_HULK_VISUAL.worldScale, options)
	const [coreVisual, scoopVisual, ventVisual] = BOILER_HULK_VISUAL.parts
	const hulk = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 19 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			attackTimer: 1.1,
			shotsSinceVent: 0,
			ventTimer: 0,
			venting: false,
			attacking: false,
			defenseCharging: false,
			defenseChargeTimer: 0,
			defenseCooldown: SCRAP_SHIELD_INITIAL_DELAY,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleArtillery,
		tags.miniBoss,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const partHp = Math.max(2, Math.round(profile.hp * 0.28))
	const scoop = addWakeEnemyPart(hulk, scoopVisual.sprite, partHp)
	const vent = addWakeEnemyPart(hulk, ventVisual.sprite, partHp)
	const scrapShield: GameObj[] = []
	const defenseChargeRing = hulk.add([
		k.circle(SCRAP_SHIELD_RADIUS, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.rgb(255, 184, 80)),
		k.opacity(0),
		k.scale(1),
		k.layer(layers.gameEffects),
		k.z(2),
	])
	composeWakeEnemy(hulk, profile, [
		{
			obj: scoop,
			hitbox: 9 * profile.scale,
			hitboxOffset: k.vec2(16, 9).scale(profile.scale),
		},
		{
			obj: vent,
			hitbox: 7 * profile.scale,
			hitboxOffset: k.vec2(5, -18).scale(profile.scale),
		},
	], 14, 2, options.onDefeated)

	registerBatchedEntityUpdate("enemies", hulk, () => {
		const delta = k.dt() * hulk.getTimescale()
		const toPlayer = playerObj.pos.sub(hulk.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		removeDestroyedScrap(scrapShield)

		if (hulk.defenseCharging) {
			updateScrapShieldCharge(
				hulk,
				defenseChargeRing,
				scrapShield,
				profile,
				delta,
				options.tags
			)
		} else if (hulk.venting) {
			hulk.ventTimer -= delta
			hulk.opacity = k.wave(0.45, 1, k.time() * 12)
			if (hulk.ventTimer <= 0) {
				hulk.venting = false
				hulk.shotsSinceVent = 0
				hulk.attackTimer = 0.65
				hulk.opacity = 1
			}
		} else {
			if (scrapShield.length === 0) hulk.defenseCooldown -= delta
			const desired = distance < 270
				? direction.scale(-1)
				: distance > 390
					? direction
					: direction.normal().scale(0.25)
			const navigationDirection = getEnemyNavigationDirection(
				hulk,
				desired.unit(),
				playerObj.pos
			)
			hulk.moveDirection = easeDirection(hulk.moveDirection, navigationDirection, 2.2, delta)
			hulk.move(hulk.moveDirection.scale(
				34 * profile.speedMultiplier * velocityScale() * hulk.getTimescale()
			))
			hulk.attackTimer -= delta * (hulk.shieldFireRateMultiplier ?? 1)
			if (
				!hulk.attacking &&
				hulk.defenseCooldown <= 0 &&
				scrapShield.length === 0 &&
				distance < 650
			) {
				startScrapShieldCharge(hulk)
			} else if (!hulk.attacking && hulk.attackTimer <= 0 && distance < 650) {
				startHulkShot(hulk, scoop, vent, profile, options.tags)
			}
		}

		hulk.angle = direction.angle() + 90
		updateScrapShieldPieces(hulk, scrapShield, profile, delta)
		applyDirectionalSteeringLean(hulk, hulk.moveDirection, direction, profile.scale)
		handleWakeCompositeCombat(hulk, "BOILER HULK", "enemy_wake_boiler_hulk_core")
	})
	hulk.onDestroy(() => destroyScrapShield(scrapShield))

	return hulk
}

function startScrapShieldCharge(hulk: any) {
	hulk.attacking = true
	hulk.defenseCharging = true
	hulk.defenseChargeTimer = SCRAP_SHIELD_CHARGE_DURATION
	gameSoundService.play("charge_zone_charge", {
		volume: mainSoundVolume * 0.6,
		detune: -180,
	})
}

function updateScrapShieldCharge(
	hulk: any,
	chargeRing: GameObj,
	scrapShield: GameObj[],
	profile: ReturnType<typeof createEnemySpawnProfile>,
	delta: number,
	extraTags?: string[]
) {
	hulk.defenseChargeTimer -= delta
	const progress = k.clamp(
		1 - hulk.defenseChargeTimer / SCRAP_SHIELD_CHARGE_DURATION,
		0,
		1
	)
	chargeRing.opacity = k.wave(0.25, 0.9, k.time() * (5 + progress * 8))
	chargeRing.scale = k.vec2(k.lerp(1.55, 0.88, progress))
	if (hulk.defenseChargeTimer > 0) return

	hulk.defenseCharging = false
	hulk.attacking = false
	hulk.defenseCooldown = SCRAP_SHIELD_COOLDOWN
	hulk.attackTimer = Math.max(hulk.attackTimer, 0.8)
	chargeRing.opacity = 0
	spawnScrapShield(hulk, scrapShield, profile, extraTags)
	spawnFlash(hulk.pos.clone(), 18, k.rgb(255, 184, 80))
	spawnRing({
		pos: hulk.pos.clone(),
		speed: 180,
		intensity: 0.22,
		maxRadius: SCRAP_SHIELD_RADIUS + 22,
		color: k.rgb(255, 184, 80),
		visualOpacity: 0.55,
		effectWidth: 10,
	})
}

function spawnScrapShield(
	hulk: GameObj,
	scrapShield: GameObj[],
	profile: ReturnType<typeof createEnemySpawnProfile>,
	extraTags?: string[]
) {
	const scrapHealth = Math.max(3, Math.round(profile.hp * 0.035))
	for (let index = 0; index < SCRAP_SHIELD_COUNT; index++) {
		const orbitAngle = index * 360 / SCRAP_SHIELD_COUNT
		const sprite = ASTEROID_SPRITES[(hulk.id + index * 3) % ASTEROID_SPRITES.length]
		const scrap = k.add([
			k.pos(hulk.pos.add(
				k.Vec2.fromAngle(orbitAngle).scale(SCRAP_SHIELD_RADIUS)
			)),
			k.sprite(sprite),
			k.anchor("center"),
			k.rotate(orbitAngle),
			k.scale(0.62 * profile.scale),
			k.color(k.WHITE),
			k.health(scrapHealth),
			k.animate(),
			timescale(),
			jitter(),
			{
				hb: SCRAP_SHIELD_HITBOX * profile.scale,
				orbitAngle,
				contactCooldown: 0,
				separationDisabled: true,
			},
			tags.enemy,
			tags.unit,
			tags.enemyRoleTerrain,
			tags.props,
			tags.gameLoop,
			tags.runtimeCullable,
			{ runtimeCullRadius: 100 },
			...(extraTags ?? []),
		])
		setHitSoundProfile(scrap, "lightMetal")
		registerHitAnimation(scrap)
		scrap.onDeath(() => {
			spawnExplosionEffect(scrap.pos.clone(), 18, { particleCount: 6 })
			spawnFlash(scrap.pos.clone(), 7, k.WHITE)
			k.destroy(scrap)
		})
		scrapShield.push(scrap)
	}
}

function updateScrapShieldPieces(
	hulk: GameObj,
	scrapShield: GameObj[],
	profile: ReturnType<typeof createEnemySpawnProfile>,
	delta: number
) {
	for (const scrap of scrapShield) {
		if (!scrap.exists()) continue
		scrap.orbitAngle += SCRAP_SHIELD_ORBIT_SPEED * delta
		scrap.pos = hulk.pos.add(
			k.Vec2.fromAngle(scrap.orbitAngle).scale(
				SCRAP_SHIELD_RADIUS * profile.scale
			)
		)
		scrap.angle += 95 * delta
		scrap.contactCooldown = Math.max(0, scrap.contactCooldown - delta)
		checkProjectileIntersection(
			scrap.pos,
			scrap.hb,
			tags.friendly,
			(projectile) => onEnemyHit(scrap, projectile)
		)
		if (!scrap.exists()) continue
		resolveScrapPlayerCollision(scrap, profile)
	}
}

function resolveScrapPlayerCollision(
	scrap: GameObj,
	profile: ReturnType<typeof createEnemySpawnProfile>
) {
	if (!playerObj.exists()) return
	const offset = playerObj.pos.sub(scrap.pos)
	const distance = offset.len()
	const minimumDistance = scrap.hb + PLAYER_HITBOX
	if (distance >= minimumDistance) return
	const collisionNormal = distance > 0.001
		? offset.scale(1 / distance)
		: k.vec2(0, -1)
	playerObj.pos = scrap.pos.add(collisionNormal.scale(minimumDistance))
	if (scrap.contactCooldown > 0 || isPlayerDamageInvulnerable()) return
	if (applyDamage(playerObj, Math.max(1, profile.damage * 0.5), {
		position: scrap.pos,
		incomingDirection: collisionNormal.scale(-1),
		source: { name: "ORBITING SCRAP", sprite: scrap.sprite },
	})) {
		scrap.contactCooldown = 0.5
	}
}

function removeDestroyedScrap(scrapShield: GameObj[]) {
	for (let index = scrapShield.length - 1; index >= 0; index--) {
		if (scrapShield[index].exists()) continue
		scrapShield.splice(index, 1)
	}
}

function destroyScrapShield(scrapShield: GameObj[]) {
	for (const scrap of scrapShield) {
		if (scrap.exists()) k.destroy(scrap)
	}
	scrapShield.length = 0
}

function startHulkShot(
	hulk: any,
	scoop: any,
	vent: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	extraTags?: string[]
) {
	hulk.attacking = true
	const targetPos = playerObj.pos.clone()
	const impactRadius = scoop.hidden ? 44 : HULK_IMPACT_RADIUS
	spawnTargetTelegraph(targetPos, impactRadius, {
		duration: profile.elite ? 0.75 : 1,
		tags: extraTags,
		onComplete: () => {
			if (!hulk.exists()) return
			const impacts = [targetPos]
			if (!scoop.hidden) {
				for (const angle of [0, 120, 240]) {
					impacts.push(targetPos.add(k.Vec2.fromAngle(angle).scale(34)))
				}
			}
			for (const impact of impacts) {
				spawnExplosionEffect(impact, scoop.hidden ? 34 : 40, { particleCount: 7 })
			}
			if (
				!isPlayerDamageInvulnerable() &&
				impacts.some((impact) => playerObj.pos.dist(impact) <= impactRadius)
			) {
				applyDamage(playerObj, hulk.damage, {
					position: targetPos,
					source: { name: "BOILER HULK", sprite: "enemy_wake_boiler_hulk_core" },
				})
			}
			hulk.shotsSinceVent++
			hulk.attacking = false
			const shotsBeforeVent = vent.hidden ? 2 : 3
			if (hulk.shotsSinceVent >= shotsBeforeVent) {
				hulk.venting = true
				hulk.ventTimer = vent.hidden ? 2.25 : 1.55
			} else {
				hulk.attackTimer = profile.elite ? 1 : 1.35
			}
		},
	})
}
