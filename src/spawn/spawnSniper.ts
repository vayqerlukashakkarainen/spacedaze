import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import { spawnEnemyBlaster } from "../services/projectileHelpers"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection, registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type SniperPhase = "reposition" | "aim"

export function spawnSniper(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, 0.95, options)
	const sniper = k.add([
		k.pos(pos),
		k.sprite("enemy_sniper"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 12 * profile.scale,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.sniper,
			phase: "reposition" as SniperPhase,
			phaseTimer: k.rand(0.4, 1.2),
			strafeDirection: k.chance(0.5) ? 1 : -1,
			moveDirection: k.vec2(0, 1),
			facingDirection: k.vec2(0, 1),
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleArtillery,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const aimLine = sniper.add([
		k.rect(1, 420),
		k.pos(0, -218),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
		k.z(-1),
	])

	registerHitAnimation(sniper)
	registerBatchedEntityUpdate("enemies", sniper, () => {
		const delta = k.dt() * sniper.getTimescale()
		sniper.phaseTimer += delta
		const toPlayer = playerObj.pos.sub(sniper.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		sniper.facingDirection = easeDirection(
			sniper.facingDirection,
			direction,
			7,
			delta
		)
		sniper.angle = sniper.facingDirection.angle() + 90

		if (sniper.phase === "reposition") {
			const tangent = k.vec2(-direction.y, direction.x).scale(sniper.strafeDirection)
			const radial = distance < 280
				? direction.scale(-1)
				: distance > 390
					? direction
					: k.vec2(0)
			const movement = tangent.scale(0.7).add(radial)
			if (movement.len() > 0) {
				sniper.moveDirection = easeDirection(
					sniper.moveDirection,
					movement.unit(),
					4.5,
					delta
				)
				sniper.move(
					sniper.moveDirection.scale(
						75 * profile.speedMultiplier * velocityScale() * sniper.getTimescale()
					)
				)
			}
			if (sniper.phaseTimer >= 2.1) {
				sniper.phase = "aim"
				sniper.phaseTimer = 0
			}
		} else {
			aimLine.opacity = k.wave(0.2, 0.9, k.time() * 10)
			if (sniper.phaseTimer >= 1) {
				const shot = spawnEnemyBlaster(
					sniper.pos.clone(),
					sniper.facingDirection,
					sniper.angle,
					sniper.damage,
					{ name: "SNIPER", sprite: "enemy_sniper" }
				)
				shot.speed = 520 * profile.speedMultiplier
				shot.color = k.rgb(255, 70, 150)
				shot.scale = k.vec2(1.35)
				sniper.phase = "reposition"
				sniper.phaseTimer = 0
				sniper.strafeDirection *= -1
				aimLine.opacity = 0
			}
		}

		checkProjectileIntersection(sniper.pos, sniper.hb, tags.friendly, (projectile) => {
			onEnemyHit(sniper, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			sniper.pos.dist(playerObj.pos) < sniper.hb + 8
		) {
			applyDamage(playerObj, sniper.damage, {
				source: { name: "SNIPER", sprite: "enemy_sniper" },
			})
			applyDamage(sniper, sniper.hp)
		}
	})

	sniper.onDeath(() => {
		enemyOnDeath(sniper.pos, 5 * profile.rewardMultiplier, 1.2 * profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(sniper)
	})
	sniper.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		sniper.animation.seek(0)
	})

	return sniper
}
