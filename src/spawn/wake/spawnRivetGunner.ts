import type { Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getEnemyNavigationDirection, hasEnemyLineOfSight } from "../../services/enemies/enemyNavigationService"
import { spawnEnemyBlaster } from "../../services/combat/projectileHelpers"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/enemies/threatService"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const GUNNER_VISUAL = getEnemyVisual("wake-rivet-gunner")

export function spawnRivetGunner(
	pos: Vec2,
	hp = 5,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, GUNNER_VISUAL.worldScale, options)
	const [coreVisual, weaponVisual] = GUNNER_VISUAL.parts
	const gunner = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 10 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			attackTimer: k.rand(0.5, 1.1),
			shotTimer: 0,
			shotsRemaining: 0,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const weapon = addWakeEnemyPart(
		gunner,
		weaponVisual.sprite,
		Math.max(1, Math.round(profile.hp * 0.4))
	)
	composeWakeEnemy(gunner, profile, [{
		obj: weapon,
		hitbox: 5 * profile.scale,
		hitboxOffset: k.vec2(4, -8).scale(profile.scale),
	}], 5, 1.1)

	registerBatchedEntityUpdate("enemies", gunner, () => {
		const delta = k.dt() * gunner.getTimescale()
		const toPlayer = playerObj.pos.sub(gunner.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const desired = weapon.hidden
			? direction.scale(-1)
			: distance < 145
				? direction.scale(-1)
				: distance > 230
					? direction
					: direction.normal().scale(0.65)
		const navigationDirection = getEnemyNavigationDirection(
			gunner,
			desired.unit(),
			weapon.hidden ? gunner.pos.add(desired.scale(220)) : playerObj.pos
		)
		gunner.moveDirection = easeDirection(gunner.moveDirection, navigationDirection, 4.5, delta)
		gunner.move(gunner.moveDirection.scale(
			(weapon.hidden ? 105 : 72) * profile.speedMultiplier * velocityScale() * gunner.getTimescale()
		))
		gunner.angle = direction.angle() + 90

		if (!weapon.hidden) {
			gunner.attackTimer -= delta * (gunner.shieldFireRateMultiplier ?? 1)
			gunner.shotTimer -= delta
			if (
				gunner.shotsRemaining === 0 &&
				gunner.attackTimer <= 0 &&
				distance < 360 &&
				hasEnemyLineOfSight(gunner, playerObj.pos)
			) {
				gunner.shotsRemaining = profile.elite ? 4 : 3
				gunner.shotTimer = 0
			}
			if (gunner.shotsRemaining > 0 && gunner.shotTimer <= 0) {
				spawnEnemyBlaster(
					gunner.pos.add(direction.scale(12)),
					direction,
					gunner.angle,
					gunner.damage,
					{
						name: profile.elite ? "ELITE RIVET GUNNER" : "RIVET GUNNER",
						sprite: "enemy_wake_rivet_gunner_core",
					},
					gunner
				)
				gunner.pos = gunner.pos.sub(direction.scale(3))
				gunner.shotsRemaining--
				gunner.shotTimer = 0.14
				if (gunner.shotsRemaining === 0) {
					gunner.attackTimer = profile.elite ? 0.9 : 1.35
				}
			}
		}
		handleWakeCompositeCombat(
			gunner,
			"RIVET GUNNER",
			"enemy_wake_rivet_gunner_core"
		)
	})

	return gunner
}
