import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import {
	compose,
	type ComposedPartObject,
	unitComponents,
} from "../../compose"
import { checkProjectileComponentIntersection, playerObj } from "../../game"
import { k, mainSoundVolume, velocityScale } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyDamage } from "../../services/combat/damageService"
import { applyDefaultExplosionForce } from "../../services/combat/explosionPulseService"
import { emitMechanicalAccelerationSmoke } from "../../services/combat/enemyDamageEffectService"
import { querySpatialNearby } from "../../services/core/runtimeSpatialIndexService"
import { isPlayerDamageInvulnerable } from "../../services/player/playerDamageState"
import type { EnemySpawnProfile } from "../../services/enemies/threatService"
import { getWakeEnemyMalfunctionChance } from "../../services/enemies/wakeMalfunctionBalance"
import { tags } from "../../tags"
import { enemyOnDeath, onEnemyHit } from "../enemyShared"
import { spawnExplosionEffect, spawnFlash } from "../spawnFlash"
import { isEnemyEmpDisrupted } from "../../services/enemies/enemyEmpService"

const MALFUNCTION_DURATION_MIN = 2.2
const MALFUNCTION_DURATION_MAX = 3.2
const MALFUNCTION_EXPLOSION_MIN_RADIUS = 56
const MALFUNCTION_ENEMY_DAMAGE_MULTIPLIER = 3
const MALFUNCTION_ENEMY_DAMAGE_MIN_FALLOFF = 0.55
const MALFUNCTION_COLLISION_PADDING = 40
const THRUSTER_MALFUNCTION_CHANCE = 0.25
const ERRATIC_MALFUNCTION_CHANCE = 0.2

type WakeMalfunctionMotion = "spiral" | "erratic" | "thruster"

interface WakeMalfunctionMotionProfile {
	mode: WakeMalfunctionMotion
	durationMin: number
	durationMax: number
	speedStart: number
	speedEnd: number
	turnStart: number
	turnEnd: number
	spinStart: number
	spinEnd: number
	wobbleStrength: number
	wobbleFrequency: number
	smokeIntervalMultiplier: number
}

export interface WakeEnemyPart {
	obj: ComposedPartObject
	hitbox: number
	hitboxOffset: Vec2
	pullForce?: number
	pullDuration?: number
	onDestroyed?: (part: GameObj, body: GameObj) => void
}

export function addWakeEnemyPart(
	parent: GameObj,
	sprite: string,
	hp: number
) {
	return parent.add([
		k.pos(0, 0),
		k.sprite(sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.rotate(0),
		k.scale(1),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	])
}

export function composeWakeEnemy(
	body: ComposedPartObject & { hb: number },
	profile: EnemySpawnProfile,
	parts: WakeEnemyPart[],
	score: number,
	powerupMultiplier: number,
	onBodyDeath?: (pos: Vec2) => void,
	deferBodyDeath?: (finish: () => void) => void
) {
	const malfunctionChance = getWakeEnemyMalfunctionChance(
		score,
		profile.elite
	)
	const deathPos = () => body.pos.clone()
	const finishBodyDeath = (pos: Vec2) => {
		if (body.exists()) k.destroy(body)
		const reconstructed = profile.rewardMode === "reconstructed"
		enemyOnDeath(
			pos,
			reconstructed ? 0 : score * profile.rewardMultiplier,
			reconstructed ? 0 : powerupMultiplier * profile.rewardMultiplier,
			"enemy",
			!reconstructed,
			{
				tier: profile.elite ? "elite" : "normal",
				material: "ship",
			},
			body
		)
		onBodyDeath?.(pos)
	}
	unitComponents[body.id] = compose({
		rewardMultiplier: profile.rewardMultiplier,
		skipDefaultBodyDeath: true,
		deferBodyDestruction: Boolean(deferBodyDeath),
		onBodyDeath: () => {
			const pos = deathPos()
			if (deferBodyDeath) {
				deferBodyDeath(() => finishBodyDeath(pos))
				return
			}
			finishBodyDeath(pos)
		},
		parts: [
			{ obj: body, hitbox: body.hb, isBody: true, scoreOnDestroy: 0 },
			...parts.map((part) => ({
				obj: part.obj,
				hitbox: part.hitbox,
				hitboxOffset: part.hitboxOffset,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: part.pullForce === undefined
					? undefined
					: part.pullForce * (profile.elite ? 1.2 : 1),
				pullDuration: part.pullDuration,
				onDestroyed: (destroyedPart: GameObj, partBody: GameObj) => {
					part.onDestroyed?.(destroyedPart, partBody)
					tryStartWakeEnemyMalfunction(
						body,
						profile,
						malfunctionChance
					)
				},
			})),
		],
	})
	body.onDestroy(() => {
		delete unitComponents[body.id]
	})
}

export function updateWakeEnemyMalfunction(body: GameObj, delta: number) {
	if (body.wakeMalfunctioning !== true) return false
	body.wakeMalfunctionElapsed += delta
	const progress = k.clamp(
		body.wakeMalfunctionElapsed / body.wakeMalfunctionDuration,
		0,
		1
	)
	const wobble = Math.sin(
		k.time() * body.wakeMalfunctionWobbleFrequency +
			body.wakeMalfunctionWobblePhase
	) * body.wakeMalfunctionWobbleStrength
	const movementTurnSpeed = k.lerp(
		body.wakeMalfunctionTurnStart,
		body.wakeMalfunctionTurnEnd,
		progress
	) + wobble
	body.wakeMalfunctionDirection = body.wakeMalfunctionDirection.rotate(
		body.wakeMalfunctionTurnDirection * movementTurnSpeed * delta
	).unit()
	const speed = k.lerp(
		body.wakeMalfunctionSpeedStart,
		body.wakeMalfunctionSpeedEnd,
		progress * progress
	)
	if (typeof body.setSnareForce === "function") {
		body.setSnareForce(
			Math.max(140, speed * 1.15),
			body.wakeMalfunctionDirection
		)
	}
	body.move(body.wakeMalfunctionDirection.scale(
		speed * body.wakeMalfunctionSpeedMultiplier * velocityScale() * body.getTimescale()
	))
	body.angle += body.wakeMalfunctionSpinDirection * (
		k.lerp(
			body.wakeMalfunctionSpinStart,
			body.wakeMalfunctionSpinEnd,
			progress
		) + wobble * 0.35
	) * delta
	body.opacity = k.wave(0.48, 1, k.time() * k.lerp(8, 22, progress))

	body.wakeMalfunctionSmokeTimer -= delta
	if (body.wakeMalfunctionSmokeTimer <= 0) {
		const exhaustPosition = body.pos.sub(
			body.wakeMalfunctionDirection.scale(k.lerp(7, 11, progress) * body.scale.x)
		)
		emitMechanicalAccelerationSmoke(
			exhaustPosition,
			body,
			body.wakeMalfunctionDirection.angle() + 180,
			body.wakeMalfunctionMotion === "thruster"
				? 4
				: progress >= 0.65 ? 2 : 1
		)
		body.wakeMalfunctionSmokeTimer = k.lerp(0.14, 0.04, progress) *
			body.wakeMalfunctionSmokeIntervalMultiplier
	}

	if (
		body.wakeMalfunctionElapsed >= body.wakeMalfunctionDuration ||
		hasWakeEnemyMalfunctionCollision(body)
	) {
		detonateWakeEnemyMalfunction(body)
		return true
	}
	handleWakeCompositeCombat(
		body,
		body.wakeMalfunctionName,
		body.wakeMalfunctionSprite
	)
	return true
}

function tryStartWakeEnemyMalfunction(
	body: GameObj,
	profile: EnemySpawnProfile,
	chance: number
) {
	if (
		!body.exists() ||
		body.is(tags.miniBoss) ||
		body.is(tags.boss) ||
		body.wakeMalfunctioning === true ||
		!k.chance(chance)
	) return
	const direction = body.moveDirection?.len() > 0.001
		? body.moveDirection.unit()
		: k.Vec2.fromAngle(k.rand(0, 360))
	const motion = createWakeMalfunctionMotionProfile()
	body.wakeMalfunctioning = true
	body.wakeMalfunctionDetonated = false
	body.wakeMalfunctionElapsed = 0
	body.wakeMalfunctionDuration = k.rand(motion.durationMin, motion.durationMax)
	body.wakeMalfunctionTurnDirection = k.chance(0.5) ? -1 : 1
	body.wakeMalfunctionSpinDirection = k.chance(0.5) ? -1 : 1
	body.wakeMalfunctionSmokeTimer = 0
	body.wakeMalfunctionDirection = direction
	body.wakeMalfunctionSpeedMultiplier = profile.speedMultiplier
	body.wakeMalfunctionMotion = motion.mode
	body.wakeMalfunctionSpeedStart = motion.speedStart
	body.wakeMalfunctionSpeedEnd = motion.speedEnd
	body.wakeMalfunctionTurnStart = motion.turnStart
	body.wakeMalfunctionTurnEnd = motion.turnEnd
	body.wakeMalfunctionSpinStart = motion.spinStart
	body.wakeMalfunctionSpinEnd = motion.spinEnd
	body.wakeMalfunctionWobbleStrength = motion.wobbleStrength
	body.wakeMalfunctionWobbleFrequency = motion.wobbleFrequency
	body.wakeMalfunctionWobblePhase = k.rand(0, Math.PI * 2)
	body.wakeMalfunctionSmokeIntervalMultiplier = motion.smokeIntervalMultiplier
	body.wakeMalfunctionDamage = profile.damage
	body.wakeMalfunctionName = motion.mode === "thruster"
		? "THRUSTER-MALFUNCTIONING WAKE MACHINE"
		: "MALFUNCTIONING WAKE MACHINE"
	body.wakeMalfunctionSprite = typeof body.sprite === "string"
		? body.sprite
		: "enemy_wake_scrap_nipper_core"
	body.opacity = 1
	if (motion.mode === "thruster") {
		spawnFlash(body.pos.clone(), Math.max(8, body.hb * 0.8), k.WHITE)
		emitMechanicalAccelerationSmoke(
			body.pos.sub(direction.scale(body.hb)),
			body,
			direction.angle() + 180,
			6
		)
		gameSoundService.playPositional("rammer_launch", body.pos, {
			volume: mainSoundVolume * 0.8,
			voiceLimit: 3,
		})
		k.shake(1.5)
	}
}

function createWakeMalfunctionMotionProfile(): WakeMalfunctionMotionProfile {
	const roll = k.rand(0, 1)
	if (roll < THRUSTER_MALFUNCTION_CHANCE) {
		return {
			mode: "thruster",
			durationMin: 1.35,
			durationMax: 2.1,
			speedStart: k.rand(380, 520),
			speedEnd: k.rand(680, 900),
			turnStart: k.rand(8, 28),
			turnEnd: k.rand(45, 105),
			spinStart: k.rand(90, 180),
			spinEnd: k.rand(240, 430),
			wobbleStrength: k.rand(8, 24),
			wobbleFrequency: k.rand(7, 12),
			smokeIntervalMultiplier: 0.42,
		}
	}
	if (roll < THRUSTER_MALFUNCTION_CHANCE + ERRATIC_MALFUNCTION_CHANCE) {
		return {
			mode: "erratic",
			durationMin: MALFUNCTION_DURATION_MIN,
			durationMax: MALFUNCTION_DURATION_MAX,
			speedStart: k.rand(70, 120),
			speedEnd: k.rand(280, 440),
			turnStart: k.rand(35, 95),
			turnEnd: k.rand(120, 250),
			spinStart: k.rand(180, 360),
			spinEnd: k.rand(650, 1050),
			wobbleStrength: k.rand(180, 320),
			wobbleFrequency: k.rand(8, 15),
			smokeIntervalMultiplier: 0.8,
		}
	}
	return {
		mode: "spiral",
		durationMin: MALFUNCTION_DURATION_MIN,
		durationMax: MALFUNCTION_DURATION_MAX,
		speedStart: k.rand(65, 95),
		speedEnd: k.rand(280, 360),
		turnStart: k.rand(80, 135),
		turnEnd: k.rand(320, 430),
		spinStart: k.rand(230, 330),
		spinEnd: k.rand(820, 1080),
		wobbleStrength: k.rand(5, 18),
		wobbleFrequency: k.rand(4, 8),
		smokeIntervalMultiplier: 1,
	}
}

function detonateWakeEnemyMalfunction(body: GameObj) {
	if (!body.exists() || body.wakeMalfunctionDetonated === true) return
	body.wakeMalfunctionDetonated = true
	const position = body.pos.clone()
	const radius = Math.max(
		MALFUNCTION_EXPLOSION_MIN_RADIUS,
		body.hb * 3
	)
	const enemies = querySpatialNearby(position, radius, {
		allTags: [tags.enemy, tags.unit],
		excludeIds: [body.id],
	})
	if (playerObj.exists() && playerObj.pos.dist(position) <= radius) {
		applyDamage(playerObj, body.wakeMalfunctionDamage, {
			position,
			source: {
				name: body.wakeMalfunctionName,
				sprite: body.wakeMalfunctionSprite,
			},
		})
	}
	for (const target of enemies) {
		if (!target.exists()) continue
		const distance = target.pos.dist(position)
		if (distance > radius) continue
		const falloff = k.lerp(
			1,
			MALFUNCTION_ENEMY_DAMAGE_MIN_FALLOFF,
			distance / radius
		)
		applyDamage(
			target,
			body.wakeMalfunctionDamage * MALFUNCTION_ENEMY_DAMAGE_MULTIPLIER * falloff,
			{
				position,
				visualForceOrigin: position,
				source: {
					name: body.wakeMalfunctionName,
					sprite: body.wakeMalfunctionSprite,
				},
			}
		)
	}
	applyDefaultExplosionForce(position, radius, { excludeIds: [body.id] })
	spawnExplosionEffect(position, radius, {
		particleCount: 16,
		persistentSmoke: true,
	})
	gameSoundService.playPositional("explosive_blast", position, {
		volume: mainSoundVolume * 0.8,
		maxDistance: 650,
	})
	k.shake(4)
	applyDamage(body, Math.max(1, body.hp), {
		position,
		showNumber: false,
	})
}

function hasWakeEnemyMalfunctionCollision(body: GameObj) {
	if (body.pos.dist(playerObj.pos) <= body.hb + 8) return true
	const nearbyEnemies = querySpatialNearby(
		body.pos,
		Math.max(MALFUNCTION_EXPLOSION_MIN_RADIUS, body.hb) +
			MALFUNCTION_COLLISION_PADDING,
		{
			allTags: [tags.enemy, tags.unit],
			excludeIds: [body.id],
		}
	)
	return nearbyEnemies.some((target) => {
		if (!target.exists()) return false
		const targetRadius = typeof target.hb === "number" ? target.hb : 8
		return body.pos.dist(target.pos) <= body.hb + targetRadius
	})
}

export function handleWakeCompositeCombat(
	body: GameObj,
	name: string,
	sprite: string,
	destroyBodyOnPlayerContact = true
) {
	const components = unitComponents[body.id]
	if (components) {
		checkProjectileComponentIntersection(
			body.pos,
			body.hb + 12,
			tags.friendly,
			components,
			(projectile, index) => onEnemyHit(components[index].obj, projectile)
		)
	}
	if (
		!isEnemyEmpDisrupted(body) &&
		!isPlayerDamageInvulnerable() &&
		body.pos.dist(playerObj.pos) < body.hb + 8
	) {
		applyDamage(playerObj, body.damage, {
			position: body.pos,
			source: { name, sprite },
		})
		if (destroyBodyOnPlayerContact) applyDamage(body, body.hp)
	}
}
