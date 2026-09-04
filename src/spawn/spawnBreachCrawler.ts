import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import {
	damageDestructibleWallsInRadius,
	getNearestDestructibleWall,
} from "../services/destructibleWallService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

export function spawnBreachCrawler(pos: Vec2, hp = 8, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, 0.92, options)
	const crawler = k.add([
		k.pos(pos), k.sprite("enemy_breach_crawler"), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 14 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			breachTimer: 0,
			targetWall: getNearestDestructibleWall(pos, 900),
			targetTimer: 0,
		},
		tags.enemy, tags.unit, tags.enemyRoleTerrain,
		...(profile.elite ? [tags.elite] : []), tags.gameLoop, ...(options.tags ?? []),
	])
	registerEnemyLifecycle(crawler, profile, 9, 1.65)
	registerBatchedEntityUpdate("enemies", crawler, () => {
		const delta = k.dt() * crawler.getTimescale()
		crawler.targetTimer -= delta
		if (crawler.targetTimer <= 0) {
			crawler.targetWall = getNearestDestructibleWall(crawler.pos, 900)
			crawler.targetTimer = 0.65
		}
		const targetPos = crawler.targetWall?.pos ?? playerObj.pos
		const toTarget = targetPos.sub(crawler.pos)
		if (toTarget.len() > 0) {
			crawler.moveDirection = easeDirection(crawler.moveDirection, toTarget.unit(), 4.2, delta)
			crawler.move(crawler.moveDirection.scale(62 * profile.speedMultiplier * velocityScale() * crawler.getTimescale()))
			crawler.angle = crawler.moveDirection.angle() + 90
		}
		crawler.breachTimer -= delta
		if (crawler.targetWall && toTarget.len() < 34 && crawler.breachTimer <= 0) {
			damageDestructibleWallsInRadius(
				crawler.pos,
				profile.elite ? 82 : 38,
				profile.elite ? 999 : 5
			)
			crawler.breachTimer = profile.elite ? 0.65 : 1
			crawler.targetTimer = 0
		}
		handleEnemyCombat(crawler, "BREACH CRAWLER", "enemy_breach_crawler")
	})
	return crawler
}
