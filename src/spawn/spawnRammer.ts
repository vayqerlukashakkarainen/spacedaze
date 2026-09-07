import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { emitEnemyTrail, starsEmitterDir, trailEmitter } from "../particles"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { createCadencedSystem } from "../services/cadencedSystemService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
} from "../services/enemyNavigationService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService"
import {
	applyDirectionalSteeringLean,
	easeDirection,
	registerHitAnimation,
} from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { addShipThruster, getShipThrusterFlash } from "../comp/shipThruster"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type RammerPhase = "approach" | "telegraph" | "charge" | "recover"

const RAMMER_CHARGE_WINDUP = 2
const ELITE_RAMMER_CHARGE_WINDUP = 0.85
const CHARGE_SOUND_DURATION = 3.34
const RAMMER_APPROACH_SPEED = 95
const RAMMER_CHARGE_SPEED = 390
const RAMMER_RECOVERY_DURATION = 0.9
const RAMMER_WINDUP_Y_SCALE = 0.8
const RAMMER_WINDUP_X_SCALE = 1.08
const RAMMER_THRUSTER_WEIGHT = 1.25
const RAMMER_WINDUP_FLAME_LENGTH = 6

interface RammerDecisionEntry {
	owner: GameObj
}

const rammerDecisionSystem = createCadencedSystem<RammerDecisionEntry>({
	id: "rammer-decisions",
	rate: 20,
	updateBucket(entries) {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index]
			if (!entry) continue
			const rammer = entry.owner
			if (!rammer.exists() || rammer.paused) continue
			const toPlayer = playerObj.pos.sub(rammer.pos)
			rammer.playerDistance = toPlayer.len()
			if (rammer.playerDistance > 0) {
				rammer.playerDirection = toPlayer.unit()
			}
		}
	},
})

export function spawnRammer(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.9, options)
	const chargeWindup = profile.elite
		? ELITE_RAMMER_CHARGE_WINDUP
		: RAMMER_CHARGE_WINDUP
	const initialTarget = playerObj.pos.sub(pos)
	const initialDistance = initialTarget.len()
	const initialDirection = initialDistance > 0
		? initialTarget.unit()
		: k.vec2(0, 1)
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
			threatRank: ENEMY_THREAT_RANK.rammer,
			phase: "approach" as RammerPhase,
			phaseTimer: 0,
			lockedDirection: initialDirection,
			steeringDirection: initialDirection,
			playerDirection: initialDirection,
			playerDistance: initialDistance,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const thruster = addShipThruster(rammer, rammer.height / 2 - 2)
	const chargeLine = rammer.add([
		k.rect(2, 190),
		k.pos(0, -105),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
		k.z(-1),
	])

	registerHitAnimation(rammer)
	rammerDecisionSystem.add({ owner: rammer })
	registerBatchedEntityUpdate("enemies", rammer, () => {
		const delta = k.dt() * rammer.getTimescale()
		let thrustSpeed = RAMMER_APPROACH_SPEED
		let launchBurst = false
		let emitTrail = false
		rammer.phaseTimer += delta
		const distance = rammer.playerDistance
		const playerDirection = rammer.playerDirection ?? rammer.lockedDirection
		rammer.scale = k.vec2(profile.scale)

		if (rammer.phase === "approach") {
			const navigationDirection = getEnemyNavigationDirection(
				rammer,
				playerDirection,
				playerObj.pos
			)
			rammer.steeringDirection = easeDirection(
				rammer.steeringDirection,
				navigationDirection,
				5,
				delta
			)
			faceDirection(rammer, rammer.steeringDirection)
			applyDirectionalSteeringLean(
				rammer,
				rammer.steeringDirection,
				playerDirection,
				profile.scale
			)
			rammer.move(
				rammer.steeringDirection.scale(RAMMER_APPROACH_SPEED * profile.speedMultiplier * velocityScale() * rammer.getTimescale())
			)
			if (
				(distance < 250 || rammer.phaseTimer >= 1.8) &&
				hasEnemyLineOfSight(rammer, playerObj.pos)
			) {
				rammer.phase = "telegraph"
				rammer.phaseTimer = 0
				rammer.lockedDirection = playerDirection
				faceDirection(rammer, rammer.lockedDirection)
				audioService.playPositionalSound(
					"wormhole_rampup",
					() => rammer.exists() ? rammer.pos : undefined,
					{
						voiceLimit: 8,
						volume: mainSoundVolume * 0.35,
						speed: CHARGE_SOUND_DURATION / chargeWindup,
						minDistance: 40,
						maxDistance: 520,
						panDistance: 260,
					}
				)
			}
		} else if (rammer.phase === "telegraph") {
			thrustSpeed = 0
			faceDirection(rammer, rammer.lockedDirection)
			const chargeProgress = k.clamp(rammer.phaseTimer / chargeWindup, 0, 1)
			const pulse = 1 + Math.sin(k.time() * 34) * 0.025 * chargeProgress
			const anticipation = chargeProgress * chargeProgress
			rammer.scale = k.vec2(
				profile.scale * k.lerp(1, RAMMER_WINDUP_X_SCALE, anticipation) * pulse,
				profile.scale * k.lerp(1, RAMMER_WINDUP_Y_SCALE, anticipation) * pulse
			)
			const flashRate = k.lerp(2.5, 9, chargeProgress)
			const flashPhase = rammer.phaseTimer * flashRate % 1
			rammer.opacity = flashPhase < 0.55 ? 1 : 0.25
			chargeLine.opacity = k.wave(0.15, 0.9, k.time() * 14)
			if (rammer.phaseTimer >= chargeWindup) {
				if (!hasEnemyLineOfSight(rammer, playerObj.pos)) {
					rammer.phase = "approach"
					rammer.phaseTimer = 0
					rammer.opacity = 1
					rammer.scale = k.vec2(profile.scale)
					chargeLine.opacity = 0
				} else {
					rammer.phase = "charge"
					rammer.phaseTimer = 0
					rammer.steeringDirection = rammer.lockedDirection
					rammer.opacity = 1
					rammer.scale = k.vec2(profile.scale)
					chargeLine.opacity = 0
					thrustSpeed = RAMMER_CHARGE_SPEED
					launchBurst = true
					audioService.playPositionalSound(
						"rammer_launch",
						() => rammer.exists() ? rammer.pos : undefined,
						{
							voiceLimit: 12,
							volume: mainSoundVolume * 0.8,
							minDistance: 35,
							maxDistance: 560,
							panDistance: 280,
						}
					)
				}
			}
		} else if (rammer.phase === "charge") {
			thrustSpeed = RAMMER_CHARGE_SPEED
			faceDirection(rammer, rammer.lockedDirection)
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
			const navigationDirection = getEnemyNavigationDirection(
				rammer,
				playerDirection,
				playerObj.pos
			)
			const recoveryProgress = k.clamp(
				rammer.phaseTimer / RAMMER_RECOVERY_DURATION,
				0,
				1
			)
			const recoveryEase = 1 - Math.pow(1 - recoveryProgress, 3)
			rammer.steeringDirection = easeDirection(
				rammer.steeringDirection,
				navigationDirection,
				k.lerp(1.5, 5, recoveryEase),
				delta
			)
			faceDirection(rammer, rammer.steeringDirection)
			applyDirectionalSteeringLean(
				rammer,
				rammer.steeringDirection,
				playerDirection,
				profile.scale
			)
			const recoverySpeed = k.lerp(
				RAMMER_CHARGE_SPEED,
				RAMMER_APPROACH_SPEED,
				recoveryEase
			)
			thrustSpeed = recoverySpeed
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

		const thrusterSpeed = rammer.phase === "telegraph"
			? 0
			: thrustSpeed * profile.speedMultiplier * rammer.getTimescale()
		thruster.updateShared(
			thrusterSpeed,
			getShipThrusterFlash(k.time()),
			RAMMER_THRUSTER_WEIGHT,
			rammer.phase === "telegraph" ? RAMMER_WINDUP_FLAME_LENGTH : 0
		)
		if (rammer.phase === "charge") {
			emitTrail = thruster.consumeParticleEmission(thrusterSpeed, delta)
		} else {
			thruster.consumeParticleEmission(0, delta)
		}
		if (emitTrail) {
			emitEnemyTrail(rammer, thruster.getExhaustPosition(), rammer.lockedDirection.angle() + 180)
		}
		if (launchBurst) {
			emitRammerLaunchBurst(thruster.getExhaustPosition(), rammer.lockedDirection, profile.elite)
		}

		checkProjectileIntersection(rammer.pos, rammer.hb, tags.friendly, (projectile) => {
			onEnemyHit(rammer, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			rammer.pos.dist(playerObj.pos) < rammer.hb + 8
		) {
			applyDamage(playerObj, rammer.damage, {
				position: rammer.pos,
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

function emitRammerLaunchBurst(
	rear: Vec2,
	direction: Vec2,
	elite: boolean
) {
	const exhaustDirection = direction.angle() + 180

	starsEmitterDir.emitter.position = rear
	starsEmitterDir.emitter.direction = exhaustDirection
	starsEmitterDir.emit(elite ? 28 : 20)

	trailEmitter.emitter.position = rear
	trailEmitter.emitter.direction = exhaustDirection
	trailEmitter.emit(elite ? 16 : 12)
}
