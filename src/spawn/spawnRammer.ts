import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { starsEmitterDir, trailEmitter } from "../particles"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection, registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type RammerPhase = "approach" | "telegraph" | "charge" | "recover"

const RAMMER_CHARGE_WINDUP = 2
const ELITE_RAMMER_CHARGE_WINDUP = 0.85
const CHARGE_SOUND_DURATION = 3.34
const RAMMER_APPROACH_SPEED = 95
const RAMMER_CHARGE_SPEED = 390
const RAMMER_RECOVERY_DURATION = 0.9

export function spawnRammer(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.9, options)
	const chargeWindup = profile.elite
		? ELITE_RAMMER_CHARGE_WINDUP
		: RAMMER_CHARGE_WINDUP
	const rammer = k.add([
		k.pos(pos),
		k.sprite("enemy_rammer"),
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
			phase: "approach" as RammerPhase,
			phaseTimer: 0,
			lockedDirection: k.vec2(0, 1),
			steeringDirection: k.vec2(0, 1),
			trailTimer: 0,
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
		k.color(k.WHITE),
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
		rammer.scale = k.vec2(profile.scale)

		if (rammer.phase === "approach") {
			rammer.steeringDirection = easeDirection(
				rammer.steeringDirection,
				playerDirection,
				5,
				delta
			)
			faceDirection(rammer, rammer.steeringDirection)
			rammer.move(
				rammer.steeringDirection.scale(RAMMER_APPROACH_SPEED * profile.speedMultiplier * velocityScale() * rammer.getTimescale())
			)
			if (distance < 250 || rammer.phaseTimer >= 1.8) {
				rammer.phase = "telegraph"
				rammer.phaseTimer = 0
				rammer.lockedDirection = playerDirection
				faceDirection(rammer, rammer.lockedDirection)
				audioService.playPositionalSound(
					"wormhole_rampup",
					() => rammer.exists() ? rammer.pos : undefined,
					{
						volume: mainSoundVolume * 0.35,
						speed: CHARGE_SOUND_DURATION / chargeWindup,
						minDistance: 40,
						maxDistance: 520,
						panDistance: 260,
					}
				)
			}
		} else if (rammer.phase === "telegraph") {
			faceDirection(rammer, rammer.lockedDirection)
			const chargeProgress = k.clamp(rammer.phaseTimer / chargeWindup, 0, 1)
			const pulse = 1 + Math.sin(k.time() * 34) * 0.025 * chargeProgress
			rammer.scale = k.vec2(profile.scale * pulse)
			const flashRate = k.lerp(2.5, 9, chargeProgress)
			const flashPhase = rammer.phaseTimer * flashRate % 1
			rammer.opacity = flashPhase < 0.55 ? 1 : 0.25
			chargeLine.opacity = k.wave(0.15, 0.9, k.time() * 14)
			if (rammer.phaseTimer >= chargeWindup) {
				rammer.phase = "charge"
				rammer.phaseTimer = 0
				rammer.trailTimer = 0
				rammer.steeringDirection = rammer.lockedDirection
				rammer.opacity = 1
				chargeLine.opacity = 0
				emitRammerLaunchBurst(
					rammer.pos,
					rammer.lockedDirection,
					profile.scale,
					profile.elite
				)
				audioService.playPositionalSound(
					"rammer_launch",
					() => rammer.exists() ? rammer.pos : undefined,
					{
						volume: mainSoundVolume * 0.8,
						minDistance: 35,
						maxDistance: 560,
						panDistance: 280,
					}
				)
				audioService.playSound("shoot1", { volume: mainSoundVolume * 0.65 })
			}
		} else if (rammer.phase === "charge") {
			faceDirection(rammer, rammer.lockedDirection)
			rammer.trailTimer += delta
			if (rammer.trailTimer >= 0.025) {
				rammer.trailTimer %= 0.025
				emitRammerTrail(rammer.pos, rammer.lockedDirection, profile.scale)
			}
			rammer.move(
				rammer.lockedDirection.scale(
					RAMMER_CHARGE_SPEED * profile.speedMultiplier * velocityScale() * rammer.getTimescale()
				)
			)
			if (rammer.phaseTimer >= 0.85) {
				rammer.phase = "recover"
				rammer.phaseTimer = 0
			}
		} else {
			const recoveryProgress = k.clamp(
				rammer.phaseTimer / RAMMER_RECOVERY_DURATION,
				0,
				1
			)
			const recoveryEase = 1 - Math.pow(1 - recoveryProgress, 3)
			rammer.steeringDirection = easeDirection(
				rammer.steeringDirection,
				playerDirection,
				k.lerp(1.5, 5, recoveryEase),
				delta
			)
			faceDirection(rammer, rammer.steeringDirection)
			const recoverySpeed = k.lerp(
				RAMMER_CHARGE_SPEED,
				RAMMER_APPROACH_SPEED,
				recoveryEase
			)
			rammer.move(
				rammer.steeringDirection.scale(
					recoverySpeed * profile.speedMultiplier * velocityScale() * rammer.getTimescale()
				)
			)
			if (rammer.phaseTimer >= RAMMER_RECOVERY_DURATION) {
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

function emitRammerTrail(pos: Vec2, direction: Vec2, scale: number) {
	trailEmitter.emitter.position = pos.sub(direction.scale(13 * scale))
	trailEmitter.emitter.direction = direction.angle() + 180
	trailEmitter.emit(2)
}

function emitRammerLaunchBurst(
	pos: Vec2,
	direction: Vec2,
	scale: number,
	elite: boolean
) {
	const rear = pos.sub(direction.scale(15 * scale))
	const exhaustDirection = direction.angle() + 180

	starsEmitterDir.emitter.position = rear
	starsEmitterDir.emitter.direction = exhaustDirection
	starsEmitterDir.emit(elite ? 28 : 20)

	trailEmitter.emitter.position = rear
	trailEmitter.emitter.direction = exhaustDirection
	trailEmitter.emit(elite ? 16 : 12)
}
