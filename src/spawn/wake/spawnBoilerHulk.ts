import type { Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { applyDamage } from "../../services/damageService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getEnemyNavigationDirection } from "../../services/enemyNavigationService"
import { spawnTargetTelegraph } from "../../services/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../../services/playerDamageState"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { spawnExplosionEffect } from "../spawnFlash"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const BOILER_HULK_VISUAL = getEnemyVisual("wake-boiler-hulk")
const HULK_IMPACT_RADIUS = 58

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

		if (hulk.venting) {
			hulk.ventTimer -= delta
			hulk.opacity = k.wave(0.45, 1, k.time() * 12)
			if (hulk.ventTimer <= 0) {
				hulk.venting = false
				hulk.shotsSinceVent = 0
				hulk.attackTimer = 0.65
				hulk.opacity = 1
			}
		} else {
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
			if (!hulk.attacking && hulk.attackTimer <= 0 && distance < 650) {
				startHulkShot(hulk, scoop, vent, profile, options.tags)
			}
		}

		hulk.angle = direction.angle() + 90
		applyDirectionalSteeringLean(hulk, hulk.moveDirection, direction, profile.scale)
		handleWakeCompositeCombat(hulk, "BOILER HULK", "enemy_wake_boiler_hulk_core")
	})

	return hulk
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
