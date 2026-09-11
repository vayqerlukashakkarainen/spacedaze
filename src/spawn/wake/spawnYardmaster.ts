import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { compose, unitComponents } from "../../compose"
import { playerObj } from "../../game"
import { BULLET_SPEED, k, mainSoundVolume, velocityScale } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { registerBossEncounter } from "../../services/enemies/bossEncounterService"
import { getBossDefinition } from "../../services/enemies/bossRegistry"
import { ENEMY_THREAT_RANK } from "../../services/enemies/threatService"
import { spawnInwardForceCone } from "../../services/combat/forceInteractionEffectService"
import { applyDamage } from "../../services/combat/damageService"
import { spawnProjectile } from "../../services/combat/projectileService"
import { spawnLineTelegraph } from "../../services/enemies/enemyTelegraphService"
import { setHitSoundProfile } from "../../services/audio/hitSoundService"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { enemyOnDeath } from "../enemyShared"
import { spawnMiniBossDeathSequence } from "../spawnEnemyDeathEffect"
import { spawnExplosionEffect, spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import { spawnRuntimeFloatingScrap } from "../rooms/spawnRoomEnvironment"
import { spawnRockDestructionFragments } from "../../services/combat/rockDestructionEffectService"
import { addWakeEnemyPart, handleWakeCompositeCombat } from "./wakeEnemyShared"

const VISUAL = getEnemyVisual("wake-yardmaster")
const BODY_HITBOX = 70
const MATERIAL_RADIUS = 430
const SUCTION_HALF_ANGLE = 38
const SUCTION_DURATION = 2.65
const YARDMASTER_ATTACK_TAG = "yardmasterAttack"
const DEBRIS_LOCK_DURATION = 1
const DEBRIS_RESUPPLY_THRESHOLD = 2
const DEBRIS_RESUPPLY_COUNT = 8
const DEBRIS_CHUNK_SPEED = 1050

type YardmasterState =
	| "recover"
	| "suction"
	| "bale"
	| "debrisLock"
	| "crusherTelegraph"
	| "crusherCharge"
	| "overrideRing"
	| "dying"

export interface YardmasterSpawnOptions {
	onDefeated?: (pos: Vec2) => void
	tags?: string[]
	rewardAmount?: number
}

export function spawnYardmaster(
	pos: Vec2,
	hp: number,
	options: YardmasterSpawnOptions = {}
) {
	const definition = getBossDefinition("wake-yardmaster")
	const [bodyVisual, armVisual, furnaceVisual] = VISUAL.parts
	const boss = k.add([
		k.pos(pos),
		k.sprite(bodyVisual.sprite),
		k.anchor("center"),
		k.rotate(0),
		k.color(k.WHITE),
		k.opacity(1),
		k.health(hp),
		k.animate(),
		k.scale(VISUAL.worldScale),
		timescale(),
		jitter(),
		{
			hb: BODY_HITBOX,
			damage: 2,
			threatRank: ENEMY_THREAT_RANK.boss,
			phaseIndex: 0,
			state: "recover" as YardmasterState,
			stateTimer: 1.5,
			attackCycle: 0,
			lockedDirection: k.vec2(0, -1),
			materialTarget: undefined as GameObj | undefined,
			materialConsumed: false,
			debrisResupplyInFlight: false,
			deathSequenceActive: false,
			baleFired: false,
			ringFired: false,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleTerrain,
		tags.boss,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(boss, "heavyMetal")

	const partHp = 5 * Math.max(10, Math.round(hp / 5 * 0.17))
	const leftArm = addWakeEnemyPart(boss, armVisual.sprite, partHp)
	leftArm.pos = k.vec2(-62, 5)
	leftArm.scale = k.vec2(-1, 1)
	const rightArm = addWakeEnemyPart(boss, armVisual.sprite, partHp)
	rightArm.pos = k.vec2(62, 5)
	const furnace = addWakeEnemyPart(boss, furnaceVisual.sprite, partHp)
	furnace.pos = k.vec2(0, 5)
	furnace.scale = k.vec2(1.25)

	let armCount = 2
	let furnaceOperational = true
	let forceEffect: GameObj | undefined
	let deathStarted = false
	unitComponents[boss.id] = compose({
		skipDefaultBodyDeath: true,
		deferBodyDestruction: true,
		parts: [
			{ obj: boss, hitbox: BODY_HITBOX, isBody: true, scoreOnDestroy: 0 },
			{
				obj: leftArm,
				hitbox: 24,
				hitboxOffset: leftArm.pos,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: 130,
				pullDuration: 1.2,
				onDestroyed: () => {
					armCount--
					staggerBoss(boss, 0.7)
				},
			},
			{
				obj: rightArm,
				hitbox: 24,
				hitboxOffset: rightArm.pos,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: 130,
				pullDuration: 1.2,
				onDestroyed: () => {
					armCount--
					staggerBoss(boss, 0.7)
				},
			},
			{
				obj: furnace,
				hitbox: 19,
				hitboxOffset: furnace.pos,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: 145,
				pullDuration: 1.35,
				onDestroyed: () => {
					furnaceOperational = false
					staggerBoss(boss, 1)
				},
			},
		],
		onBodyDeath: beginDeath,
	})

	registerBossEncounter(boss, definition.id, {
		maxHealth: hp,
		deferDefeatUntilDestroy: true,
		onPhaseChanged: (_phase, phaseIndex) => {
			boss.phaseIndex = phaseIndex
			boss.attackCycle = 0
			if (phaseIndex === 0) return
			stopForceEffect()
			staggerBoss(boss, 0.85)
			spawnFlash(boss.pos.clone(), 48, phaseIndex === 1
				? k.rgb(255, 184, 80)
				: k.WHITE)
			spawnRing({
				pos: boss.pos.clone(),
				speed: 310,
				intensity: 0.7,
				maxRadius: 230,
				visualize: true,
				color: k.rgb(255, 184, 80),
				effectWidth: 24,
			})
			k.shake(7)
		},
		onDefeated: options.onDefeated,
	})

	registerBatchedEntityUpdate("enemies", boss, () => {
		if (boss.deathSequenceActive) return
		const delta = k.dt() * boss.getTimescale()
		boss.stateTimer -= delta
		const toPlayer = playerObj.pos.sub(boss.pos)
		if (toPlayer.len() > 0.001 && boss.state !== "crusherCharge") {
			const desired = toPlayer.angle() + 90
			boss.angle += shortestAngleDelta(boss.angle, desired) *
				(1 - Math.exp(-2.8 * delta))
		}

		if (boss.state === "recover") {
			if (boss.stateTimer <= 0) beginNextAttack()
		} else if (boss.state === "suction") {
			updateSuction(delta)
			if (boss.stateTimer <= 0) beginBale()
		} else if (boss.state === "bale") {
			if (!boss.baleFired && boss.stateTimer <= 0.52) {
				boss.baleFired = true
				fireBaleCone(boss, options.tags)
			}
			if (boss.stateTimer <= 0) enterRecovery(1.05)
		} else if (boss.state === "debrisLock") {
			const targetOffset = playerObj.pos.sub(boss.pos)
			if (targetOffset.len() > 0.001) {
				boss.lockedDirection = targetOffset.unit()
			}
			boss.opacity = k.wave(0.55, 1, k.time() * 13)
			if (boss.stateTimer <= 0) {
				fireChargedDebrisChunk(boss, options.tags)
				enterRecovery(1.15)
			}
		} else if (boss.state === "crusherTelegraph") {
			if (boss.stateTimer <= 0) beginCrusherCharge()
		} else if (boss.state === "crusherCharge") {
			boss.pos = boss.pos.add(boss.lockedDirection.scale(
				440 * velocityScale() * delta
			))
			boss.jitter(4)
			if (boss.stateTimer <= 0) {
				spawnExplosionEffect(boss.pos.clone(), 62, { particleCount: 20 })
				k.shake(8)
				enterRecovery(1.25)
			}
		} else if (boss.state === "overrideRing") {
			if (!boss.ringFired && boss.stateTimer <= 0.48) {
				boss.ringFired = true
				fireOverrideRing(boss, options.tags)
			}
			if (boss.stateTimer <= 0) enterRecovery(0.8)
		}
		handleWakeCompositeCombat(
			boss,
			definition.name,
			bodyVisual.sprite,
			false
		)
	})

	boss.onDestroy(() => {
		stopForceEffect()
		k.destroyAll(YARDMASTER_ATTACK_TAG)
		delete unitComponents[boss.id]
	})

	return boss

	function beginNextAttack() {
		boss.attackCycle++
		if (
			!boss.debrisResupplyInFlight &&
			getArenaMaterialTargets().length <= DEBRIS_RESUPPLY_THRESHOLD
		) {
			beginDebrisLock()
			return
		}
		if (boss.phaseIndex >= 2 && boss.attackCycle % 3 === 0) {
			beginOverrideRing()
			return
		}
		if (boss.phaseIndex >= 1 && boss.attackCycle % 3 === 2) {
			beginCrusherTelegraph()
			return
		}
		beginSuction()
	}

	function beginDebrisLock() {
		stopForceEffect()
		boss.state = "debrisLock"
		boss.stateTimer = DEBRIS_LOCK_DURATION
		const targetOffset = playerObj.pos.sub(boss.pos)
		boss.lockedDirection = targetOffset.len() > 0.001
			? targetOffset.unit()
			: k.vec2(0, -1)
		spawnLineTelegraph(
			boss.pos.clone(),
			boss.pos.add(boss.lockedDirection.scale(1000)),
			{
				duration: DEBRIS_LOCK_DURATION,
				tags: [YARDMASTER_ATTACK_TAG, ...(options.tags ?? [])],
				getStart: () => boss.exists()
					? boss.pos.add(boss.lockedDirection.scale(70))
					: undefined,
				getEnd: () => boss.exists()
					? boss.pos.add(boss.lockedDirection.scale(1000))
					: undefined,
			}
		)
		gameSoundService.playPositional("charge_zone_charge", boss.pos, {
			volume: mainSoundVolume * 0.78,
			detune: -220,
		})
		boss.jitter(8)
	}

	function beginSuction() {
		const target = findMaterialTarget(boss)
		if (!target) {
			beginBale()
			return
		}
		boss.state = "suction"
		boss.stateTimer = SUCTION_DURATION
		boss.materialTarget = target
		boss.materialConsumed = false
		const mouth = () => boss.exists()
			? boss.pos.add(k.Vec2.fromAngle(boss.angle - 90).scale(57))
			: undefined
		forceEffect = spawnInwardForceCone({
			origin: mouth,
			direction: () => {
				const origin = mouth()
				const material = boss.materialTarget as GameObj | undefined
				if (!origin || !material?.exists()) return k.Vec2.fromAngle(boss.angle - 90)
				const offset = material.pos.sub(origin)
				return offset.len() > 0.001 ? offset.unit() : k.Vec2.fromAngle(boss.angle - 90)
			},
			radius: MATERIAL_RADIUS,
			halfAngle: SUCTION_HALF_ANGLE,
			duration: SUCTION_DURATION,
			intensity: 1.45,
			color: k.rgb(180, 235, 255),
			extraTags: options.tags,
			shakeTags: [tags.roomEnvironment, tags.player],
		})
		gameSoundService.playPositional("wormhole_rampup", boss.pos, {
			volume: mainSoundVolume * 0.72,
			detune: -320,
			voiceLimit: 1,
		})
		boss.jitter(5)
		k.shake(2.5)
	}

	function updateSuction(delta: number) {
		const target = boss.materialTarget as GameObj | undefined
		if (!target?.exists()) return
		const mouth = boss.pos.add(k.Vec2.fromAngle(boss.angle - 90).scale(55))
		const offset = mouth.sub(target.pos)
		if (offset.len() <= 62) {
			if (boss.materialConsumed) return
			boss.materialConsumed = true
			applyDamage(target, Math.max(1, Number(target.hp ?? 1)) * 2, {
				position: mouth,
				visualForceOrigin: target.pos,
				showNumber: false,
			})
			if (boss.exists() && furnaceOperational) {
				boss.hp = Math.min(boss.maxHP, boss.hp + 4)
			}
			spawnExplosionEffect(mouth, 34, {
				particleCount: 14,
				color: k.rgb(255, 184, 80),
			})
			spawnFlash(mouth, 15, k.WHITE)
			boss.jitter(12)
			k.shake(5)
			return
		}
		const pullSpeed = (85 + armCount * 55) * (1 + boss.phaseIndex * 0.18)
		target.pos = target.pos.add(offset.unit().scale(pullSpeed * delta))
		target.angle = (target.angle ?? 0) + (110 + armCount * 35) * delta
	}

	function beginBale() {
		stopForceEffect()
		boss.state = "bale"
		boss.stateTimer = 0.92
		boss.baleFired = false
	}

	function beginCrusherTelegraph() {
		boss.state = "crusherTelegraph"
		boss.stateTimer = 0.78
		const offset = playerObj.pos.sub(boss.pos)
		boss.lockedDirection = offset.len() > 0.001 ? offset.unit() : k.vec2(0, -1)
		spawnLineTelegraph(
			boss.pos.clone(),
			boss.pos.add(boss.lockedDirection.scale(760)),
			{ duration: 0.78, tags: options.tags }
		)
		gameSoundService.playPositional("charge_zone_charge", boss.pos, {
			volume: mainSoundVolume * 0.65,
			detune: -150,
		})
		boss.jitter(7)
	}

	function beginCrusherCharge() {
		boss.state = "crusherCharge"
		boss.stateTimer = 0.56
		gameSoundService.playPositional("rammer_launch", boss.pos, {
			volume: mainSoundVolume * 0.82,
		})
		spawnFlash(boss.pos.clone(), 34, k.WHITE)
		k.shake(7)
	}

	function beginOverrideRing() {
		boss.state = "overrideRing"
		boss.stateTimer = 0.9
		boss.ringFired = false
		gameSoundService.playPositional("charge_zone_charge", boss.pos, {
			volume: mainSoundVolume * 0.65,
			detune: 170,
		})
	}

	function enterRecovery(duration: number) {
		stopForceEffect()
		boss.state = "recover"
		boss.stateTimer = furnaceOperational ? duration : duration * 1.55
		boss.opacity = 1
	}

	function stopForceEffect() {
		if (forceEffect?.exists()) k.destroy(forceEffect)
		forceEffect = undefined
	}

	function beginDeath() {
		if (deathStarted) return
		deathStarted = true
		boss.deathSequenceActive = true
		boss.state = "dying"
		boss.unuse(tags.enemy)
		boss.unuse(tags.unit)
		stopForceEffect()
		k.destroyAll(YARDMASTER_ATTACK_TAG)
		spawnMiniBossDeathSequence(boss, {
			radius: 72,
			color: k.rgb(255, 184, 80),
			onComplete: () => {
				enemyOnDeath(
					boss.pos.clone(),
					options.rewardAmount ?? 18,
					definition.rewardMultiplier,
					"boss",
					false,
					{ intensity: 5, starCount: 100, material: "ship" },
					boss
				)
				if (boss.exists()) k.destroy(boss)
			},
		})
	}
}

function findMaterialTarget(boss: GameObj) {
	return getArenaMaterialTargets()
		.filter((target) => target.pos.dist(boss.pos) <= MATERIAL_RADIUS)
		.sort((a, b) => a.pos.dist(boss.pos) - b.pos.dist(boss.pos))[0]
}

function getArenaMaterialTargets() {
	return [
		...(k.get(tags.roomCover) as GameObj[]),
		...(k.get(tags.roomVolatile) as GameObj[]),
	].filter((target, index, all) =>
		target.exists() &&
		target.pos &&
		all.findIndex((candidate) => candidate.id === target.id) === index
	)
}

function fireChargedDebrisChunk(boss: GameObj, extraTags?: string[]) {
	if (!boss.exists()) return
	const direction = boss.lockedDirection.len() > 0.001
		? boss.lockedDirection.unit()
		: k.vec2(0, -1)
	const muzzle = boss.pos.add(direction.scale(72))
	boss.debrisResupplyInFlight = true
	let shattered = false
	const chunk = spawnProjectile({
		pos: muzzle,
		dir: direction,
		rotation: direction.angle() + 90,
		sprite: "rock_fragment_32_b",
		tint: k.rgb(255, 184, 80),
		effectTint: k.rgb(255, 184, 80),
		visualScale: 2.2,
		visualPulse: { amplitude: 0.08, frequency: 15 },
		speed: DEBRIS_CHUNK_SPEED,
		tags: [tags.enemy, tags.blaster, YARDMASTER_ATTACK_TAG, ...(extraTags ?? [])],
		impact: { damage: boss.damage * 6 },
		piercing: { maxPierces: 1, damageReduction: 0 },
		trail: { emitterType: "dust", offset: 14, particleCount: 2 },
		lifespan: { duration: 3 },
		onWorldCollision: (_projectile, collision) => {
			if (shattered) return
			shattered = true
			shatterChargedDebrisChunk(collision.position, collision.normal)
		},
		damageSource: {
			name: "YARDMASTER DEBRIS DRIVER",
			sprite: "boss_wake_yardmaster",
		},
	})
	chunk.onDestroy(() => {
		if (boss.exists()) boss.debrisResupplyInFlight = false
	})
	gameSoundService.playPositional("rammer_launch", muzzle, {
		volume: mainSoundVolume,
		detune: -260,
	})
	spawnFlash(muzzle, 34, k.rgb(255, 184, 80))
	boss.jitter(13)
	k.shake(8)
}

function shatterChargedDebrisChunk(position: Vec2, wallNormal: Vec2) {
	const inward = wallNormal.len() > 0.001
		? wallNormal.unit()
		: k.vec2(0, -1)
	const spawnOrigin = position.add(inward.scale(24))
	for (let index = 0; index < DEBRIS_RESUPPLY_COUNT; index++) {
		const progress = index / (DEBRIS_RESUPPLY_COUNT - 1)
		const direction = inward.rotate(
			k.lerp(-72, 72, progress) + k.rand(-8, 8)
		)
		const tangent = direction.normal().scale(k.rand(-10, 10))
		spawnRuntimeFloatingScrap(
			spawnOrigin.add(tangent),
			direction.scale(k.rand(105, 165))
		)
	}
	spawnExplosionEffect(position, 72, {
		particleCount: 28,
		persistentSmoke: true,
		color: k.rgb(255, 184, 80),
	})
	spawnRockDestructionFragments(position, 1.4)
	spawnRing({
		pos: position.clone(),
		speed: 300,
		intensity: 0.82,
		maxRadius: 190,
		visualize: true,
		color: k.rgb(255, 184, 80),
		effectWidth: 26,
	})
	gameSoundService.playPositional("explosive_blast", position, {
		volume: mainSoundVolume,
		detune: -180,
	})
	k.shake(10)
}

function fireBaleCone(boss: GameObj, extraTags?: string[]) {
	const direction = playerObj.pos.sub(boss.pos).unit()
	const count = 5 + boss.phaseIndex * 2
	for (let index = 0; index < count; index++) {
		const spread = count === 1 ? 0 : k.lerp(-24, 24, index / (count - 1))
		const shotDirection = direction.rotate(spread)
		spawnProjectile({
			pos: boss.pos.add(shotDirection.scale(66)),
			dir: shotDirection,
			rotation: shotDirection.angle() + 90,
			sprite: "particle3",
			visualScale: k.rand(1.5, 2.25),
			speed: BULLET_SPEED,
			speedMultiplier: 0.42,
			tags: [tags.enemy, tags.blaster, YARDMASTER_ATTACK_TAG, ...(extraTags ?? [])],
			impact: { damage: boss.damage * 0.72 },
			lifespan: { duration: 4 },
			fireSound: index === 0 ? "shoot1" : undefined,
			damageSource: {
				name: "THE YARDMASTER",
				sprite: "boss_wake_yardmaster",
			},
		})
	}
	spawnFlash(boss.pos.add(direction.scale(64)), 24, k.rgb(255, 184, 80))
	boss.jitter(8)
	k.shake(4)
}

function fireOverrideRing(boss: GameObj, extraTags?: string[]) {
	const count = 18
	const safeAngle = playerObj.pos.sub(boss.pos).angle()
	for (let index = 0; index < count; index++) {
		const angle = index * 360 / count
		if (Math.abs(shortestAngleDelta(angle, safeAngle)) < 28) continue
		const direction = k.Vec2.fromAngle(angle)
		spawnProjectile({
			pos: boss.pos.add(direction.scale(62)),
			dir: direction,
			rotation: angle + 90,
			sprite: "particle3",
			visualScale: 1.4,
			speed: BULLET_SPEED,
			speedMultiplier: 0.38,
			tags: [tags.enemy, tags.blaster, YARDMASTER_ATTACK_TAG, ...(extraTags ?? [])],
			impact: { damage: boss.damage * 0.65 },
			lifespan: { duration: 4 },
			damageSource: { name: "FOREMAN OVERRIDE", sprite: "boss_wake_yardmaster" },
		})
	}
	spawnRing({
		pos: boss.pos.clone(),
		speed: 360,
		intensity: 0.9,
		maxRadius: 260,
		visualize: true,
		color: k.rgb(255, 184, 80),
		effectWidth: 30,
	})
	gameSoundService.playPositional("explosive_blast", boss.pos, {
		volume: mainSoundVolume * 0.8,
	})
	boss.jitter(11)
	k.shake(7)
}

function staggerBoss(boss: GameObj, duration: number) {
	if (!boss.exists() || boss.deathSequenceActive) return
	boss.state = "recover"
	boss.stateTimer = duration
	boss.jitter(14)
	spawnFlash(boss.pos.clone(), 24, k.WHITE)
	k.shake(4)
}

function shortestAngleDelta(from: number, to: number) {
	return ((to - from + 540) % 360) - 180
}
