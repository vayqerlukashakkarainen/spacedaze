import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type RammerPhase = "approach" | "telegraph" | "charge" | "recover"

export function spawnRammer(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.9, options)
	const rammer = k.add([
		k.pos(pos),
		k.sprite("enemy_rammer"),
		k.color(profile.elite ? 120 : 255, profile.elite ? 190 : 145, 55),
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
			phase: "approach" as RammerPhase,
			phaseTimer: 0,
			lockedDirection: k.vec2(0, 1),
		},
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const chargeLine = rammer.add([
		k.rect(2, 190),
		k.pos(0, -105),
		k.anchor("center"),
		k.color(255, 105, 45),
		k.opacity(0),
		k.z(-1),
	])

	registerHitAnimation(rammer)
	registerBatchedEntityUpdate("enemies", rammer, () => {
		const delta = k.dt() * rammer.getTimescale()
		rammer.phaseTimer += delta
		const toPlayer = playerObj.pos.sub(rammer.pos)
		const distance = toPlayer.len()
		const playerDirection = distance > 0 ? toPlayer.unit() : rammer.lockedDirection

		if (rammer.phase === "approach") {
			faceDirection(rammer, playerDirection)
			rammer.move(
				playerDirection.scale(95 * profile.speedMultiplier * velocityScale() * rammer.getTimescale())
			)
			if (distance < 250 || rammer.phaseTimer >= 1.8) {
				rammer.phase = "telegraph"
				rammer.phaseTimer = 0
			}
		} else if (rammer.phase === "telegraph") {
			faceDirection(rammer, playerDirection)
			rammer.lockedDirection = playerDirection
			chargeLine.opacity = k.wave(0.15, 0.9, k.time() * 14)
			if (rammer.phaseTimer >= 0.75) {
				rammer.phase = "charge"
				rammer.phaseTimer = 0
				chargeLine.opacity = 0
				audioService.playSound("shoot1", { volume: mainSoundVolume * 0.65 })
			}
		} else if (rammer.phase === "charge") {
			faceDirection(rammer, rammer.lockedDirection)
			rammer.move(
				rammer.lockedDirection.scale(
					390 * profile.speedMultiplier * velocityScale() * rammer.getTimescale()
				)
			)
			if (rammer.phaseTimer >= 0.85) {
				rammer.phase = "recover"
				rammer.phaseTimer = 0
			}
		} else {
			rammer.move(
				rammer.lockedDirection.scale(55 * velocityScale() * rammer.getTimescale())
			)
			if (rammer.phaseTimer >= 0.9) {
				rammer.phase = "approach"
				rammer.phaseTimer = 0
			}
		}

		checkProjectileIntersection(rammer.pos, rammer.hb, tags.friendly, (projectile) => {
			onEnemyHit(rammer, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			rammer.pos.dist(playerObj.pos) < rammer.hb + 8
		) {
			applyDamage(playerObj, rammer.damage, {
				source: { name: "RAMMER", sprite: "enemy_rammer" },
			})
			applyDamage(rammer, rammer.hp)
		}
	})

	rammer.onDeath(() => {
		enemyOnDeath(rammer.pos, 4 * profile.rewardMultiplier, profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(rammer)
	})
	rammer.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		rammer.animation.seek(0)
	})

	return rammer
}

function faceDirection(enemy: { angle: number }, direction: Vec2) {
	enemy.angle = direction.angle() + 90
}
