import type { GameObj } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, subSoundVolume } from "../main"
import { gameSoundService } from "../services/gameSoundService"
import { applyDamage } from "../services/damageService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import type { EnemySpawnProfile } from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

export function handleEnemyCombat(
	enemy: GameObj,
	name: string,
	sprite: string
) {
	checkProjectileIntersection(enemy.pos, enemy.hb, tags.friendly, (projectile) => {
		onEnemyHit(enemy, projectile)
	})
	if (
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
	enemy: GameObj,
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
			{ tier: profile.elite ? "elite" : "normal" }
		)
		gameSoundService.play("enemy_explosion", { volume: subSoundVolume })
		k.destroy(enemy)
	})
	enemy.onHurt(() => {
		enemy.animation.seek(0)
	})
}
