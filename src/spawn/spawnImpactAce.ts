import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { starsEmitterDir, trailEmitter } from "../particles"
import { audioService } from "../services/audioService"
import { registerBossEncounter } from "../services/bossEncounterService"
import { getBossDefinition, getBossHealth } from "../services/bossRegistry"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import { spawnEnemyBlaster } from "../services/projectileHelpers"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService"
import { applyDirectionalSteeringLean, easeDirection, registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type ImpactAceState = "approach" | "telegraph" | "charge" | "recover"

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
		1.28,
		{ ...options, elite: false }
	)
	const initialDirection = directionToPlayer(pos)
	const ace = k.add([
		k.pos(pos),
		k.sprite("enemy_rammer"),
		k.color(k.WHITE),
		k.rotate(initialDirection.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		{
			hb: 18 * profile.scale,
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
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.miniBoss,
		tags.gameLoop,
		...(options.tags ?? []),
	])
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
			spawnPhasePulse(ace.pos, profile.scale, phaseIndex)
			if (phaseIndex > 0) k.shake(3 + phaseIndex * 2)
		},
		onDefeated: options.onDefeated,
	})

	registerBatchedEntityUpdate("enemies", ace, () => {
		const delta = k.dt() * ace.getTimescale()
		ace.stateTimer += delta
		ace.scale = k.vec2(profile.scale)
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
			if (distance < 285 || ace.stateTimer >= 1.5 - ace.phaseIndex * 0.18) {
				beginTelegraph(ace, true)
			}
		} else if (ace.state === "telegraph") {
			ace.angle = ace.lockedDirection.angle() + 90
			const windup = 0.78 - ace.phaseIndex * 0.13
			const progress = k.clamp(ace.stateTimer / windup, 0, 1)
			ace.scale = k.vec2(
				profile.scale * k.lerp(1, 1.3, progress * progress),
				profile.scale * k.lerp(1, 0.74, progress * progress)
			)
			ace.opacity = ace.stateTimer * (7 + ace.phaseIndex * 2) % 1 < 0.65 ? 1 : 0.3
			chargeLine.opacity = k.wave(0.18, 0.9, k.time() * 12)
			if (ace.stateTimer >= windup) beginCharge(ace, profile.scale)
		} else if (ace.state === "charge") {
			ace.angle = ace.lockedDirection.angle() + 90
			moveAce(ace, 410 + ace.phaseIndex * 55, profile.speedMultiplier)
			emitChargeTrail(ace.pos, ace.lockedDirection, profile.scale, ace, delta)
			if (ace.stateTimer >= 0.68) finishCharge(ace)
		} else {
			ace.moveDirection = easeDirection(
				ace.moveDirection,
				playerDirection,
				2.8,
				delta
			)
			moveAce(ace, k.lerp(210, 80, k.clamp(ace.stateTimer / 0.55, 0, 1)), profile.speedMultiplier)
			faceAce(ace, ace.moveDirection, playerDirection, profile.scale)
			if (ace.stateTimer >= 0.55) {
				if (ace.chargesRemaining > 0) beginTelegraph(ace, false)
				else setState(ace, "approach")
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
				source: { name: definition.name, sprite: "enemy_rammer" },
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
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.shake(9)
		k.destroy(ace)
	})
	ace.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
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
	audioService.playPositionalSound(
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
	audioService.playPositionalSound(
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

function fireRadialBurst(pos: Vec2, damage: number) {
	for (let index = 0; index < 10; index++) {
		const direction = k.Vec2.fromAngle(index * 36)
		const projectile = spawnEnemyBlaster(
			pos.clone(),
			direction,
			direction.angle() + 90,
			damage,
			{ name: "IMPACT ACE", sprite: "enemy_rammer" }
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
		scale
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
