import type { AnimateComp, GameObj, HealthComp, PosComp } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k } from "../main"
import { applyDamage } from "../services/combat/damageService"
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState"
import type { EnemySpawnProfile } from "../services/enemies/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { isEnemyEmpDisrupted } from "../services/enemies/enemyEmpService"

type EnemyCombatObject = GameObj<PosComp | HealthComp | AnimateComp> & {
	hb: number
	damage: number
}

export function handleEnemyCombat(
	enemy: EnemyCombatObject,
	name: string,
	sprite: string
) {
	checkProjectileIntersection(enemy.pos, enemy.hb, tags.friendly, (projectile) => {
		onEnemyHit(enemy, projectile)
	})
	if (
		!isEnemyEmpDisrupted(enemy) &&
		!isPlayerDamageInvulnerable() &&
		enemy.pos.dist(playerObj.pos) < enemy.hb + 8
	) {
		applyDamage(playerObj, enemy.damage, {
			position: enemy.pos,
			source: { name, sprite },
		})
		applyDamage(enemy, enemy.hp)
	}
}

export function registerEnemyLifecycle(
	enemy: EnemyCombatObject,
	profile: EnemySpawnProfile,
	score: number,
	powerupMultiplier: number,
	onBeforeDestroy?: () => void
) {
	registerHitAnimation(enemy)
	enemy.onDeath(() => {
		onBeforeDestroy?.()
		const reconstructed = profile.rewardMode === "reconstructed"
		enemyOnDeath(
			enemy.pos,
			reconstructed ? 0 : score * profile.rewardMultiplier,
			reconstructed ? 0 : powerupMultiplier * profile.rewardMultiplier,
			"enemy",
			!reconstructed,
			{
				tier: profile.elite ? "elite" : "normal",
				material: "ship",
			},
			enemy
		)
		k.destroy(enemy)
	})
	enemy.onHurt(() => {
		enemy.animation.seek(0)
	})
}
