import type { GameObj } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, subSoundVolume } from "../main"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import type { EnemySpawnProfile } from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
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
		enemyOnDeath(
			enemy.pos,
			score * profile.rewardMultiplier,
			powerupMultiplier * profile.rewardMultiplier,
			"enemy",
			true,
			{ tier: profile.elite ? "elite" : "normal" }
		)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(enemy)
	})
	enemy.onHurt(() => {
		enemy.animation.seek(0)
	})
}
