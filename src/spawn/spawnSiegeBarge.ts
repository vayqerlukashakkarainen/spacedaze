import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { spawnArtilleryBoulder } from "../services/combat/artilleryBoulderService"
import { applyDamage } from "../services/combat/damageService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { getEnemyNavigationDirection } from "../services/enemies/enemyNavigationService"
import { spawnTargetTelegraph } from "../services/enemies/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/enemies/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnExplosionEffect } from "./spawnFlash"

const IMPACT_RADIUS = 54
const SIEGE_BARGE_VISUAL = getEnemyVisual("siege-barge")

export function spawnSiegeBarge(
	pos: Vec2,
	hp = 10,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, SIEGE_BARGE_VISUAL.worldScale, options)
	const barge = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(SIEGE_BARGE_VISUAL)),
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
			facingDirection: k.vec2(0, 1),
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
		const desiredDirection = getEnemyNavigationDirection(
			barge,
			desired.unit(),
			playerObj.pos
		)
		barge.moveDirection = easeDirection(barge.moveDirection, desiredDirection, 2.2, delta)
		barge.move(barge.moveDirection.scale(
			38 * profile.speedMultiplier * velocityScale() * barge.getTimescale()
		))
		barge.facingDirection = easeDirection(barge.facingDirection, direction, 4, delta)
		barge.angle = barge.facingDirection.angle() + 90
		applyDirectionalSteeringLean(
			barge,
			barge.facingDirection,
			direction,
			profile.scale
		)

		if (!barge.attacking) {
			barge.attackTimer -= delta * (barge.shieldFireRateMultiplier ?? 1)
			if (barge.attackTimer <= 0 && distance < 620) {
				barge.attacking = true
				const targetPos = playerObj.pos.clone()
				const impactDelay = profile.elite ? 0.78 : 1.05
				spawnArtilleryBoulder(
					barge.pos.clone(),
					targetPos,
					impactDelay,
					options.tags
				)
				spawnTargetTelegraph(targetPos, IMPACT_RADIUS, {
					duration: impactDelay,
					tags: options.tags,
					onComplete: () => {
						if (!barge.exists()) return
						spawnExplosionEffect(targetPos, IMPACT_RADIUS, { particleCount: 9 })
						if (
							!isPlayerDamageInvulnerable() &&
							playerObj.pos.dist(targetPos) <= IMPACT_RADIUS
						) {
							applyDamage(playerObj, barge.damage, {
								position: targetPos,
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
