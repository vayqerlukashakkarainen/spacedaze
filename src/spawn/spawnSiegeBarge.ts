import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { spawnTargetTelegraph } from "../services/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnExplosionEffect } from "./spawnFlash"

const IMPACT_RADIUS = 54

export function spawnSiegeBarge(
	pos: Vec2,
	hp = 10,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, 1.15, options)
	const barge = k.add([
		k.pos(pos),
		k.sprite("enemy_siege_barge"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 18 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			attackTimer: k.rand(1, 2),
			attacking: false,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleArtillery,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerEnemyLifecycle(barge, profile, 10, 1.8)
	registerBatchedEntityUpdate("enemies", barge, () => {
		const delta = k.dt() * barge.getTimescale()
		const toPlayer = playerObj.pos.sub(barge.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const desired = distance < 320
			? direction.scale(-1)
			: distance > 430
				? direction
				: direction.normal().scale(0.25)
		barge.moveDirection = easeDirection(barge.moveDirection, desired.unit(), 2.2, delta)
		barge.move(barge.moveDirection.scale(
			38 * profile.speedMultiplier * velocityScale() * barge.getTimescale()
		))
		barge.angle = direction.angle() + 90

		if (!barge.attacking) {
			barge.attackTimer -= delta * (barge.shieldFireRateMultiplier ?? 1)
			if (barge.attackTimer <= 0 && distance < 620) {
				barge.attacking = true
				const targetPos = playerObj.pos.clone()
				spawnTargetTelegraph(targetPos, IMPACT_RADIUS, {
					duration: profile.elite ? 0.78 : 1.05,
					tags: options.tags,
					onComplete: () => {
						if (!barge.exists()) return
						spawnExplosionEffect(targetPos, IMPACT_RADIUS, { particleCount: 9 })
						if (
							!isPlayerDamageInvulnerable() &&
							playerObj.pos.dist(targetPos) <= IMPACT_RADIUS
						) {
							applyDamage(playerObj, barge.damage, {
								source: { name: "SIEGE BARGE", sprite: "enemy_siege_barge" },
							})
						}
						barge.attacking = false
						barge.attackTimer = profile.elite ? 1.35 : 1.8
					},
				})
			}
		}
		handleEnemyCombat(barge, "SIEGE BARGE", "enemy_siege_barge")
	})

	return barge
}
