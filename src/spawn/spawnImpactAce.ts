import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { starsEmitterDir, trailEmitter } from "../particles"
import { gameSoundService } from "../services/gameSoundService"
import { registerBossEncounter } from "../services/bossEncounterService"
import { getBossDefinition, getBossHealth } from "../services/bossRegistry"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { setHitSoundProfile } from "../services/hitSoundService"
import { hasEnemyLineOfSight } from "../services/enemyNavigationService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import { spawnEnemyBlaster } from "../services/projectileHelpers"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService"
import { applyDirectionalSteeringLean, easeDirection, registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type ImpactAceState =
	| "approach"
	| "telegraph"
	| "charge"
	| "recover"
	| "stationCharge"
	| "stationFire"
	| "stationWindDown"
type ImpactAceMode = "ramming" | "station"

const IMPACT_ACE_VISUAL = getEnemyVisual("impact-ace")
const IMPACT_ACE_SPRITE = requirePrimaryVisualSprite(IMPACT_ACE_VISUAL)
const STATION_FIRE_DURATION = 3
const STATION_SPREAD_DEGREES = 28

interface ImpactAceOptions extends EnemySpawnOptions {
	tags?: string[]
	onDefeated?: (pos: Vec2) => void
}

export function spawnImpactAce(
	pos: Vec2,
	runDepth: number,
	options: ImpactAceOptions = {}
) {
	const definition = getBossDefinition("impact-ace")
	const profile = createEnemySpawnProfile(
		getBossHealth("impact-ace", runDepth),
		2,
		IMPACT_ACE_VISUAL.worldScale,
		{ ...options, elite: false }
	)
	const initialDirection = directionToPlayer(pos)
	const ace = k.add([
		k.pos(pos),
		k.sprite(IMPACT_ACE_SPRITE),
		k.color(k.WHITE),
		k.rotate(initialDirection.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		{
			hb: 26 * profile.scale,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.miniBoss,
			baseScale: profile.scale,
			moveDirection: initialDirection,
			lockedDirection: initialDirection,
			state: "approach" as ImpactAceState,
			stateTimer: 0,
			phaseIndex: 0,
			chargesRemaining: 0,
			trailTimer: 0,
			nextAttackMode: "ramming" as ImpactAceMode,
			shotTimer: 0,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.miniBoss,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(ace, "heavyMetal")
	const chargeLine = ace.add([
		k.rect(2, 280),
		k.pos(0, -150),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
		k.z(-1),
	])

	registerHitAnimation(ace)
	registerBossEncounter(ace, definition.id, {
		maxHealth: profile.hp,
		onPhaseChanged: (_phase, phaseIndex) => {
			ace.phaseIndex = phaseIndex
			if (phaseIndex === 1) ace.nextAttackMode = "station"
			spawnPhasePulse(ace.pos, profile.scale, phaseIndex)
			if (phaseIndex > 0) k.shake(3 + phaseIndex * 2)
		},
		onDefeated: options.onDefeated,
	})

	registerBatchedEntityUpdate("enemies", ace, () => {
		const delta = k.dt() * ace.getTimescale()
		ace.stateTimer += delta
		const toPlayer = playerObj.pos.sub(ace.pos)
		const distance = toPlayer.len()
		const playerDirection = distance > 0 ? toPlayer.unit() : ace.moveDirection

		if (ace.state === "approach") {
			ace.moveDirection = easeDirection(
				ace.moveDirection,
				playerDirection,
				4.5 + ace.phaseIndex,
				delta
			)
			moveAce(ace, 92 + ace.phaseIndex * 12, profile.speedMultiplier)
			faceAce(ace, ace.moveDirection, playerDirection, profile.scale)
			if (
				(distance < 285 || ace.stateTimer >= getApproachCooldown(ace.phaseIndex)) &&
				hasEnemyLineOfSight(ace, playerObj.pos)
			) {
				if (ace.phaseIndex >= 1 && ace.nextAttackMode === "station") {
					beginStationCharge(ace, playerDirection)
				} else {
					beginTelegraph(ace, true)
				}
			}
		} else if (ace.state === "telegraph") {
			ace.angle = ace.lockedDirection.angle() + 90
			const windup = getRamWindup(ace.phaseIndex)
			const progress = k.clamp(ace.stateTimer / windup, 0, 1)
			ace.scale = k.vec2(
				profile.scale * k.lerp(1, 1.3, progress * progress),
				profile.scale * k.lerp(1, 0.74, progress * progress)
			)
			ace.opacity = ace.stateTimer * (7 + ace.phaseIndex * 2) % 1 < 0.65 ? 1 : 0.3
			chargeLine.opacity = k.wave(0.18, 0.9, k.time() * 12)
			if (ace.stateTimer >= windup) {
				if (hasEnemyLineOfSight(ace, playerObj.pos)) {
					beginCharge(ace, profile.scale)
				} else {
					ace.opacity = 1
					ace.scale = k.vec2(profile.scale)
					chargeLine.opacity = 0
					ace.chargesRemaining = 0
					setState(ace, "approach")
				}
			}
		} else if (ace.state === "charge") {
			ace.angle = ace.lockedDirection.angle() + 90
			moveAce(ace, 410 + ace.phaseIndex * 55, profile.speedMultiplier)
			emitChargeTrail(ace.pos, ace.lockedDirection, profile.scale, ace, delta)
			if (ace.stateTimer >= getRamChargeDuration(ace.phaseIndex)) {
				finishCharge(ace)
			}
		} else if (ace.state === "recover") {
			ace.moveDirection = easeDirection(
				ace.moveDirection,
				playerDirection,
				2.8,
				delta
			)
			const recoveryDuration = getRamRecovery(ace.phaseIndex)
			moveAce(
				ace,
				k.lerp(210, 80, k.clamp(ace.stateTimer / recoveryDuration, 0, 1)),
				profile.speedMultiplier
			)
			faceAce(ace, ace.moveDirection, playerDirection, profile.scale)
			if (ace.stateTimer >= recoveryDuration) {
				if (
					ace.chargesRemaining > 0 &&
					hasEnemyLineOfSight(ace, playerObj.pos)
				) beginTelegraph(ace, false)
				else finishRammingMode(ace)
			}
		} else if (ace.state === "stationCharge") {
			updateStationFacing(ace, playerDirection, delta, 6 + ace.phaseIndex * 2)
			const duration = getStationChargeDuration(ace.phaseIndex)
			const progress = k.clamp(ace.stateTimer / duration, 0, 1)
			ace.scale = k.vec2(
				profile.scale * k.lerp(1, 0.78, progress),
				profile.scale * k.lerp(1, 1.18, progress)
			)
			ace.opacity = ace.stateTimer * (9 + ace.phaseIndex * 2) % 1 < 0.72
				? 1
				: 0.45
			if (ace.stateTimer >= duration) beginStationFire(ace, profile.scale)
		} else if (ace.state === "stationFire") {
			updateStationFacing(ace, playerDirection, delta, 8 + ace.phaseIndex * 2)
			const interval = getStationShotInterval(ace.phaseIndex)
			ace.shotTimer -= delta
			if (ace.shotTimer <= 0) {
				if (hasEnemyLineOfSight(ace, playerObj.pos)) {
					fireStationShot(ace, profile.scale)
				}
				ace.shotTimer += interval
			}
			const recoil = k.clamp(ace.shotTimer / interval, 0, 1)
			ace.scale = k.vec2(
				profile.scale * (1 + recoil * 0.08),
				profile.scale * (1 - recoil * 0.12)
			)
			ace.opacity = 1
			if (ace.stateTimer >= STATION_FIRE_DURATION) {
				setState(ace, "stationWindDown")
			}
		} else {
			updateStationFacing(ace, playerDirection, delta, 4 + ace.phaseIndex)
			const duration = getStationWindDownDuration(ace.phaseIndex)
			const progress = k.clamp(ace.stateTimer / duration, 0, 1)
			const wobble = Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.05
			ace.scale = k.vec2(
				profile.scale * (k.lerp(1.08, 1, progress) + wobble),
				profile.scale * (k.lerp(0.88, 1, progress) - wobble)
			)
			if (ace.stateTimer >= duration) {
				ace.scale = k.vec2(profile.scale)
				ace.nextAttackMode = "ramming"
				setState(ace, "approach")
			}
		}

		checkProjectileIntersection(ace.pos, ace.hb, tags.friendly, (projectile) => {
			onEnemyHit(ace, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			ace.pos.dist(playerObj.pos) < ace.hb + 8
		) {
			applyDamage(playerObj, ace.damage, {
				position: ace.pos,
				source: {
					name: definition.name,
					sprite: IMPACT_ACE_SPRITE,
				},
			})
		}
	})

	ace.onDeath(() => {
		enemyOnDeath(
			ace.pos,
			18 * definition.rewardMultiplier,
			definition.rewardMultiplier,
			"boss",
			false,
			{ intensity: 4, starCount: 55 }
		)
		gameSoundService.play("enemy_explosion", { volume: subSoundVolume })
		k.destroy(ace)
	})
	ace.onHurt(() => {
		ace.animation.seek(0)
	})

	return ace
}

function beginTelegraph(
	ace: ReturnType<typeof k.add>,
	startingCombo: boolean
) {
	ace.lockedDirection = directionToPlayer(ace.pos)
	if (startingCombo) ace.chargesRemaining = ace.phaseIndex
	setState(ace, "telegraph")
	gameSoundService.playPositional(
		"wormhole_rampup",
		() => ace.exists() ? ace.pos : undefined,
		{ volume: mainSoundVolume * 0.55, voiceLimit: 2 }
	)
}

function beginCharge(ace: ReturnType<typeof k.add>, scale: number) {
	ace.moveDirection = ace.lockedDirection
	ace.opacity = 1
	ace.scale = k.vec2(scale)
	ace.children[0].opacity = 0
	setState(ace, "charge")
	starsEmitterDir.emitter.position = ace.pos.sub(ace.lockedDirection.scale(16 * scale))
	starsEmitterDir.emitter.direction = ace.lockedDirection.angle() + 180
	starsEmitterDir.emit(30)
	gameSoundService.playPositional(
		"rammer_launch",
		() => ace.exists() ? ace.pos : undefined,
		{ volume: mainSoundVolume, voiceLimit: 3 }
	)
}

function finishCharge(ace: ReturnType<typeof k.add>) {
	if (ace.phaseIndex >= 2) fireRadialBurst(ace.pos, ace.damage)
	ace.chargesRemaining = Math.max(0, ace.chargesRemaining - 1)
	setState(ace, "recover")
}

function finishRammingMode(ace: ReturnType<typeof k.add>) {
	ace.opacity = 1
	ace.scale = k.vec2(ace.baseScale)
	ace.children[0].opacity = 0
	ace.nextAttackMode = ace.phaseIndex >= 1 ? "station" : "ramming"
	setState(ace, "approach")
}

function beginStationCharge(
	ace: ReturnType<typeof k.add>,
	playerDirection: Vec2
) {
	ace.lockedDirection = playerDirection
	ace.chargesRemaining = 0
	ace.opacity = 1
	ace.scale = k.vec2(ace.baseScale)
	ace.children[0].opacity = 0
	setState(ace, "stationCharge")
	gameSoundService.playPositional(
		"wormhole_rampup",
		() => ace.exists() ? ace.pos : undefined,
		{ volume: mainSoundVolume * 0.7, voiceLimit: 2 }
	)
}

function beginStationFire(
	ace: ReturnType<typeof k.add>,
	scale: number
) {
	ace.opacity = 1
	ace.scale = k.vec2(scale)
	ace.shotTimer = 0
	setState(ace, "stationFire")
	starsEmitterDir.emitter.position = ace.pos.add(
		ace.lockedDirection.scale(18 * scale)
	)
	starsEmitterDir.emitter.direction = ace.lockedDirection.angle()
	starsEmitterDir.emit(18)
}

function updateStationFacing(
	ace: ReturnType<typeof k.add>,
	playerDirection: Vec2,
	delta: number,
	response: number
) {
	ace.lockedDirection = easeDirection(
		ace.lockedDirection,
		playerDirection,
		response,
		delta
	)
	ace.angle = ace.lockedDirection.angle() + 90
}

function fireStationShot(
	ace: ReturnType<typeof k.add>,
	scale: number
) {
	const targetDirection = directionToPlayer(ace.pos)
	const direction = k.Vec2.fromAngle(
		targetDirection.angle() + k.rand(
			-STATION_SPREAD_DEGREES,
			STATION_SPREAD_DEGREES
		)
	)
	const projectile = spawnEnemyBlaster(
		ace.pos.add(ace.lockedDirection.scale(20 * scale)),
		direction,
		direction.angle() + 90,
		ace.damage * 0.55,
		{ name: "IMPACT ACE", sprite: IMPACT_ACE_SPRITE }
	)
	projectile.speed *= ace.phaseIndex >= 2 ? 0.76 : 0.68
}

function getApproachCooldown(phaseIndex: number) {
	return [1.5, 1.32, 0.98][phaseIndex]
}

function getRamWindup(phaseIndex: number) {
	return [0.78, 0.65, 0.48][phaseIndex]
}

function getRamChargeDuration(phaseIndex: number) {
	return [0.68, 0.68, 0.5][phaseIndex]
}

function getRamRecovery(phaseIndex: number) {
	return [0.55, 0.55, 0.36][phaseIndex]
}

function getStationChargeDuration(phaseIndex: number) {
	return phaseIndex >= 2 ? 0.46 : 0.72
}

function getStationShotInterval(phaseIndex: number) {
	return phaseIndex >= 2 ? 0.085 : 0.13
}

function getStationWindDownDuration(phaseIndex: number) {
	return phaseIndex >= 2 ? 0.42 : 0.68
}

function fireRadialBurst(pos: Vec2, damage: number) {
	for (let index = 0; index < 10; index++) {
		const direction = k.Vec2.fromAngle(index * 36)
		const projectile = spawnEnemyBlaster(
			pos.clone(),
			direction,
			direction.angle() + 90,
			damage,
			{ name: "IMPACT ACE", sprite: IMPACT_ACE_SPRITE }
		)
		projectile.speed *= 0.58
	}
}

function moveAce(
	ace: ReturnType<typeof k.add>,
	speed: number,
	speedMultiplier: number
) {
	ace.move(ace.moveDirection.scale(
		speed * speedMultiplier * velocityScale() * ace.getTimescale()
	))
}

function faceAce(
	ace: ReturnType<typeof k.add>,
	movementDirection: Vec2,
	targetDirection: Vec2,
	scale: number
) {
	ace.angle = movementDirection.angle() + 90
	applyDirectionalSteeringLean(
		ace,
		movementDirection,
		targetDirection,
		scale,
		false,
		45,
		28
	)
}

function directionToPlayer(pos: Vec2) {
	const delta = playerObj.pos.sub(pos)
	return delta.len() > 0 ? delta.unit() : k.vec2(0, 1)
}

function setState(ace: ReturnType<typeof k.add>, state: ImpactAceState) {
	ace.state = state
	ace.stateTimer = 0
}

function emitChargeTrail(
	pos: Vec2,
	direction: Vec2,
	scale: number,
	ace: ReturnType<typeof k.add>,
	delta: number
) {
	ace.trailTimer += delta
	if (ace.trailTimer < 0.025) return
	ace.trailTimer %= 0.025
	trailEmitter.emitter.position = pos.sub(direction.scale(16 * scale))
	trailEmitter.emitter.direction = direction.angle() + 180
	trailEmitter.emit(3)
}

function spawnPhasePulse(pos: Vec2, scale: number, phaseIndex: number) {
	if (phaseIndex === 0) return
	k.add([
		k.pos(pos),
		k.circle(24 * scale, { fill: false }),
		k.outline(3, k.WHITE),
		k.anchor("center"),
		k.opacity(0.9),
		k.scale(1),
		k.lifespan(0.55, { fade: 0.35 }),
		tags.gameLoop,
	])
}
