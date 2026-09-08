import type { GameObj, Vec2 } from "kaplay"
import { detach } from "../compose"
import { jitter } from "../comp/jitter"
import { timescale } from "../comp/timescale"
import { checkProjectileIntersection, playerObj } from "../game"
import {
	BULLET_SPEED,
	k,
	layers,
	mainSoundVolume,
	subSoundVolume,
	velocityScale,
} from "../main"
import { starsEmitter } from "../particles"
import { audioService } from "../services/audioService"
import { registerBossEncounter } from "../services/bossEncounterService"
import { getBossDefinition } from "../services/bossRegistry"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { hasEnemyLineOfSight } from "../services/enemyNavigationService"
import { spawnLineTelegraph } from "../services/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import { spawnProjectile } from "../services/projectileService"
import { ENEMY_THREAT_RANK } from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { spawnGravityPull } from "./spawnGravityPull"

const BODY_HITBOX = 62
const BATTERY_HITBOX = 19
const CROWN_HITBOX = 17
const CLAIMKEEPER_ATTACK_TAG = "claimkeeperAttack"
const CLAIMKEEPER_BODY_SPRITES = [
	"boss1_body",
	"boss1_body_phase2",
	"boss1_body_phase3",
] as const

type DreadnoughtState =
	| "entry"
	| "recover"
	| "broadside"
	| "lanceTelegraph"
	| "lanceFire"
	| "tractorCharge"
	| "tractorPull"
	| "reactorCharge"
	| "reactorVolley"

interface BossOptions {
	onDefeated?: (pos: Vec2) => void
	tags?: string[]
	skipEntry?: boolean
}

interface TargetableBossPart {
	obj: GameObj
	hitbox: number
	isAlive: () => boolean
}

export function spawnBoss1(
	pos: Vec2,
	am: number,
	hp: number,
	scale: number,
	options: BossOptions = {}
) {
	const definition = getBossDefinition("federation-dreadnought")
	const batteryOffset = k.vec2(43, 2)
	const crownOffset = k.vec2(0, -34)
	const muzzleOffset = k.vec2(0, -22)
	const arenaAnchor = pos.clone()
	const spawnPos = options.skipEntry ? pos.clone() : pos.add(0, 180)
	const boss = k.add([
		k.pos(spawnPos),
		k.sprite(CLAIMKEEPER_BODY_SPRITES[0]),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.opacity(options.skipEntry ? 1 : 0),
		k.scale(scale),
		jitter(),
		timescale(),
		{
			hb: BODY_HITBOX * scale,
			threatRank: ENEMY_THREAT_RANK.boss,
			baseScale: scale,
			combatState: (options.skipEntry ? "recover" : "entry") as DreadnoughtState,
			stateTimer: 0,
			recoveryDuration: options.skipEntry ? 1.5 : 1.2,
			phaseIndex: 0,
			attackCycle: 0,
			shotsRemaining: 0,
			shotTimer: 0,
			ringIndex: 0,
			nextBattery: "left" as "left" | "right",
			lockedDirection: k.vec2(0, 1),
			damage: 1,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.boss,
		tags.gameLoop,
		...(options.tags ?? []),
	])

	const leftBattery = boss.add([
		k.pos(batteryOffset.scale(-1)),
		k.sprite("boss1_part_target"),
		k.anchor("center"),
		k.health(Math.max(8, Math.round(hp * 0.18))),
		k.animate(),
		k.opacity(1),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		tags.part,
		tags.gameLoop,
	])
	const leftMuzzle = leftBattery.add([
		k.pos(muzzleOffset),
		k.anchor("center"),
	])
	const rightBattery = boss.add([
		k.pos(batteryOffset),
		k.sprite("boss1_part_target"),
		k.anchor("center"),
		k.health(Math.max(8, Math.round(hp * 0.18))),
		k.animate(),
		k.opacity(1),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		tags.part,
		tags.gameLoop,
	])
	const rightMuzzle = rightBattery.add([
		k.pos(muzzleOffset),
		k.anchor("center"),
	])
	const crown = boss.add([
		k.pos(crownOffset),
		k.sprite("boss1_part_target"),
		k.anchor("center"),
		k.health(Math.max(7, Math.round(hp * 0.15))),
		k.animate(),
		k.opacity(1),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		tags.part,
		tags.gameLoop,
	])
	const attackRing = boss.add([
		k.pos(crownOffset),
		k.circle(170, { fill: false }),
		k.outline(2, k.WHITE),
		k.anchor("center"),
		k.opacity(0),
		k.scale(0.2),
		k.z(-1),
	])
	const gravity = spawnGravityPull({
		pos: crown.worldPos.clone(),
		radius: 0,
		strength: 0,
		falloff: 0.72,
		targetTags: [tags.player],
		visualizePull: true,
		tags: options.tags,
	})

	let leftBatteryAlive = true
	let rightBatteryAlive = true
	let crownAlive = true
	let defeated = false

	const targetableParts: TargetableBossPart[] = [
		{
			obj: leftBattery,
			hitbox: BATTERY_HITBOX * scale,
			isAlive: () => leftBatteryAlive,
		},
		{
			obj: rightBattery,
			hitbox: BATTERY_HITBOX * scale,
			isAlive: () => rightBatteryAlive,
		},
		{
			obj: crown,
			hitbox: CROWN_HITBOX * scale,
			isAlive: () => crownAlive,
		},
	]

	const stopActiveField = () => {
		gravity.radius = 0
		gravity.strength = 0
		attackRing.opacity = 0
	}

	const enterRecovery = (duration = 1.2) => {
		boss.combatState = "recover"
		boss.stateTimer = 0
		boss.recoveryDuration = duration
		boss.shotTimer = 0
		stopActiveField()
		resetPartOpacity(leftBattery, leftBatteryAlive)
		resetPartOpacity(rightBattery, rightBatteryAlive)
	}

	const beginLance = () => {
		boss.combatState = "lanceTelegraph"
		boss.stateTimer = 0
		boss.lockedDirection = directionToPlayer(boss.pos)
		const duration = [0.84, 0.72, 0.58][boss.phaseIndex]
		spawnLineTelegraph(
			boss.pos.clone(),
			boss.pos.add(boss.lockedDirection.scale(900)),
			{
				duration,
				tags: [CLAIMKEEPER_ATTACK_TAG, ...(options.tags ?? [])],
				onComplete: () => {
					if (
						!boss.exists() ||
						boss.combatState !== "lanceTelegraph"
					) return
					if (!hasEnemyLineOfSight(boss, playerObj.pos)) {
						enterRecovery(0.35)
						return
					}
					boss.combatState = "lanceFire"
					boss.stateTimer = 0
					boss.shotTimer = 0
					boss.shotsRemaining = 6 + boss.phaseIndex
				},
			}
		)
		audioService.playPositionalSound(
			"wormhole_rampup",
			() => boss.exists() ? boss.pos : undefined,
			{ volume: mainSoundVolume * 0.28, voiceLimit: 1 }
		)
	}

	const beginBroadside = () => {
		if (!leftBatteryAlive && !rightBatteryAlive) {
			beginLance()
			return
		}
		boss.combatState = "broadside"
		boss.stateTimer = 0
		boss.shotTimer = boss.phaseIndex === 2 ? 0.52 : 0.7
		boss.shotsRemaining = 4 + boss.phaseIndex
	}

	const beginTractor = () => {
		if (!crownAlive) {
			beginBroadside()
			return
		}
		boss.combatState = "tractorCharge"
		boss.stateTimer = 0
		boss.shotTimer = 0
		attackRing.pos = crownOffset.clone()
		attackRing.scale = k.vec2(0.2)
		attackRing.opacity = 0.85
		audioService.playPositionalSound(
			"wormhole_ambience",
			() => crown.exists() ? crown.worldPos : undefined,
			{ volume: mainSoundVolume * 0.22, voiceLimit: 1 }
		)
	}

	const beginReactor = () => {
		boss.combatState = "reactorCharge"
		boss.stateTimer = 0
		boss.shotTimer = 0
		boss.ringIndex = 0
		attackRing.pos = k.vec2(0, 0)
		attackRing.scale = k.vec2(0.12)
		attackRing.opacity = 0.95
		audioService.playPositionalSound(
			"wormhole_rampup",
			() => boss.exists() ? boss.pos : undefined,
			{ volume: mainSoundVolume * 0.36, detune: 220, voiceLimit: 1 }
		)
	}

	const beginNextAttack = () => {
		const hasSight = hasEnemyLineOfSight(boss, playerObj.pos)
		const attacks = boss.phaseIndex === 0
			? ["broadside", "lance"] as const
			: boss.phaseIndex === 1
				? ["tractor", "broadside", "lance"] as const
				: ["reactor", "lance", "broadside"] as const
		for (let offset = 0; offset < attacks.length; offset++) {
			const attack = attacks[(boss.attackCycle + offset) % attacks.length]
			if (attack !== "reactor" && !hasSight) continue
			if (attack === "tractor" && !crownAlive) continue
			if (
				attack === "broadside" &&
				!leftBatteryAlive &&
				!rightBatteryAlive
			) continue
			boss.attackCycle += offset + 1
			if (attack === "tractor") beginTractor()
			else if (attack === "reactor") beginReactor()
			else if (attack === "broadside") beginBroadside()
			else beginLance()
			return
		}
		if (boss.phaseIndex === 2) beginReactor()
		else enterRecovery(0.25)
	}

	registerHitAnimation(boss)
	registerHitAnimation(leftBattery)
	registerHitAnimation(rightBattery)
	registerHitAnimation(crown)
	for (const part of [leftBattery, rightBattery, crown]) {
		part.onHurt(() => {
			audioService.playSound("hit1", { volume: mainSoundVolume * 0.8 })
			part.animation.seek(0)
		})
	}
	registerBossEncounter(boss, definition.id, {
		maxHealth: hp,
		onPhaseChanged: (_phase, phaseIndex) => {
			boss.phaseIndex = phaseIndex
			boss.use(k.sprite(CLAIMKEEPER_BODY_SPRITES[phaseIndex]))
			boss.attackCycle = 0
			if (phaseIndex === 0 || boss.combatState === "entry") return
			spawnBossPhasePulse(boss.pos, scale, phaseIndex)
			boss.jitter(7 + phaseIndex * 3)
			k.shake(3 + phaseIndex * 2)
			enterRecovery(0.9)
		},
		onDefeated: options.onDefeated,
	})

	leftBattery.onDeath(() => {
		if (!leftBatteryAlive) return
		leftBatteryAlive = false
		destroyBossPart(leftBattery, "boss1_blaster", boss, hp, scale)
	})
	rightBattery.onDeath(() => {
		if (!rightBatteryAlive) return
		rightBatteryAlive = false
		destroyBossPart(rightBattery, "boss1_blaster", boss, hp, scale)
	})
	crown.onDeath(() => {
		if (!crownAlive) return
		crownAlive = false
		destroyBossPart(crown, "boss1_head", boss, hp, scale)
		if (
			boss.combatState === "tractorCharge" ||
			boss.combatState === "tractorPull"
		) enterRecovery(1.35)
	})

	registerBatchedEntityUpdate("enemies", boss, () => {
		const delta = k.dt() * velocityScale() * boss.getTimescale()
		boss.stateTimer += delta
		boss.scale = k.vec2(
			boss.baseScale * k.wave(0.992, 1.008, k.time() * 1.7)
		)
		faceBattery(leftBattery, leftBatteryAlive, playerObj.pos, delta)
		faceBattery(rightBattery, rightBatteryAlive, playerObj.pos, delta)
		gravity.pos = crownAlive ? crown.worldPos.clone() : boss.pos.clone()

		if (boss.combatState === "entry") {
			boss.opacity = k.lerp(
				boss.opacity,
				1,
				1 - Math.exp(-4 * delta)
			)
			moveBossToward(boss, arenaAnchor, 2.8, delta)
			if (boss.pos.dist(arenaAnchor) <= 3) {
				boss.pos = arenaAnchor.clone()
				boss.opacity = 1
				k.shake(4)
				enterRecovery(1.5)
			}
		} else if (boss.combatState === "recover") {
			updateBossDrift(boss, arenaAnchor, delta, boss.phaseIndex)
			if (boss.stateTimer >= boss.recoveryDuration) beginNextAttack()
		} else if (boss.combatState === "broadside") {
			updateBossDrift(boss, arenaAnchor, delta, boss.phaseIndex, 0.52)
			updateBroadsideTelegraph(
				boss,
				leftBattery,
				rightBattery,
				leftBatteryAlive,
				rightBatteryAlive
			)
			boss.shotTimer -= delta
			if (boss.shotTimer <= 0 && boss.shotsRemaining > 0) {
				if (!hasEnemyLineOfSight(boss, playerObj.pos)) {
					enterRecovery(0.35)
				} else {
					fireBroadsideVolley(
						boss,
						leftMuzzle,
						rightMuzzle,
						leftBatteryAlive,
						rightBatteryAlive,
						options.tags
					)
					boss.shotsRemaining--
					boss.shotTimer = [0.3, 0.26, 0.22][boss.phaseIndex]
					if (boss.shotsRemaining === 0) enterRecovery(1.25)
				}
			}
		} else if (boss.combatState === "lanceFire") {
			boss.shotTimer -= delta
			if (boss.shotTimer <= 0 && boss.shotsRemaining > 0) {
				if (!hasEnemyLineOfSight(boss, playerObj.pos)) {
					enterRecovery(0.35)
				} else {
					const spread = boss.shotsRemaining % 2 === 0 ? -1.25 : 1.25
					const direction = k.Vec2.fromAngle(
						boss.lockedDirection.angle() + spread
					)
					spawnClaimkeeperProjectile(
						boss.pos.add(direction.scale(30 * scale)),
						direction,
						boss.damage,
						0.92,
						boss.shotsRemaining === 6 + boss.phaseIndex,
						options.tags
					)
					boss.shotsRemaining--
					boss.shotTimer = [0.13, 0.115, 0.1][boss.phaseIndex]
					if (boss.shotsRemaining === 0) enterRecovery(1.35)
				}
			}
		} else if (boss.combatState === "tractorCharge") {
			const progress = k.clamp(boss.stateTimer / 0.92, 0, 1)
			attackRing.scale = k.vec2(k.lerp(0.2, 1, progress))
			attackRing.opacity = k.wave(0.35, 0.95, k.time() * 10)
			if (!crownAlive) enterRecovery(1.35)
			else if (progress >= 1) {
				if (!hasEnemyLineOfSight(boss, playerObj.pos)) {
					enterRecovery(0.35)
				} else {
					boss.combatState = "tractorPull"
					boss.stateTimer = 0
					boss.shotTimer = 0.25
					gravity.radius = 440
					gravity.strength = 150
				}
			}
		} else if (boss.combatState === "tractorPull") {
			if (!hasEnemyLineOfSight(boss, playerObj.pos)) {
				enterRecovery(0.35)
			} else {
				attackRing.scale = k.vec2(k.wave(0.92, 1.04, k.time() * 5))
				attackRing.opacity = k.wave(0.18, 0.48, k.time() * 7)
				boss.shotTimer -= delta
				if (boss.shotTimer <= 0) {
					fireBroadsideVolley(
						boss,
						leftMuzzle,
						rightMuzzle,
						leftBatteryAlive,
						rightBatteryAlive,
						options.tags,
						[-11, 11]
					)
					boss.shotTimer = 0.44
				}
				if (!crownAlive || boss.stateTimer >= 1.7) enterRecovery(1.45)
			}
		} else if (boss.combatState === "reactorCharge") {
			const progress = k.clamp(boss.stateTimer / 0.76, 0, 1)
			attackRing.pos = k.vec2(0, 0)
			attackRing.scale = k.vec2(k.lerp(0.12, 0.72, progress))
			attackRing.opacity = k.wave(0.45, 1, k.time() * 13)
			if (progress >= 1) {
				boss.combatState = "reactorVolley"
				boss.stateTimer = 0
				boss.shotTimer = 0
				boss.shotsRemaining = 3
			}
		} else if (boss.combatState === "reactorVolley") {
			boss.shotTimer -= delta
			if (boss.shotTimer <= 0 && boss.shotsRemaining > 0) {
				fireReactorRing(boss, options.tags)
				boss.shotsRemaining--
				boss.ringIndex++
				boss.shotTimer = 0.46
				if (boss.shotsRemaining === 0) enterRecovery(1.55)
			}
		}

		resolveBossProjectileHits(boss, targetableParts)
		if (
			!isPlayerDamageInvulnerable() &&
			boss.pos.dist(playerObj.pos) < boss.hb + 8
		) {
			applyDamage(playerObj, boss.damage, {
				position: boss.pos,
				source: { name: definition.name, sprite: "boss1_body" },
			})
		}
	})

	boss.onDeath(() => {
		if (defeated) return
		defeated = true
		stopActiveField()
		k.destroyAll(CLAIMKEEPER_ATTACK_TAG)
		enemyOnDeath(
			boss.pos,
			am,
			definition.rewardMultiplier,
			"boss",
			false,
			{ intensity: 4.5, starCount: 90 }
		)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(boss)
	})
	boss.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		boss.animation.seek(0)
	})
	boss.onDestroy(() => {
		stopActiveField()
		if (gravity.exists()) k.destroy(gravity)
		k.destroyAll(CLAIMKEEPER_ATTACK_TAG)
	})

	return boss
}
function resetPartOpacity(part: GameObj, alive: boolean) {
	if (alive && part.exists()) part.opacity = 1
}

function moveBossToward(
	boss: GameObj,
	target: Vec2,
	response: number,
	delta: number
) {
	const blend = 1 - Math.exp(-response * delta)
	boss.pos = boss.pos.lerp(target, blend)
}

function updateBossDrift(
	boss: GameObj,
	anchor: Vec2,
	delta: number,
	phaseIndex: number,
	responseMultiplier = 1
) {
	const amplitude = 72 + phaseIndex * 11
	const target = anchor.add(
		Math.sin(k.time() * (0.48 + phaseIndex * 0.05)) * amplitude,
		Math.cos(k.time() * 0.31) * 16
	)
	moveBossToward(boss, target, 1.45 * responseMultiplier, delta)
}

function faceBattery(
	battery: GameObj,
	alive: boolean,
	target: Vec2,
	delta: number
) {
	if (!alive || !battery.exists()) return
	const direction = target.sub(battery.worldPos)
	if (direction.len() <= 0) return
	const desired = direction.angle() + 90
	const turn = shortestAngleDelta(battery.angle, desired)
	battery.angle += turn * (1 - Math.exp(-7 * delta))
}

function updateBroadsideTelegraph(
	boss: GameObj,
	leftBattery: GameObj,
	rightBattery: GameObj,
	leftAlive: boolean,
	rightAlive: boolean
) {
	if (boss.stateTimer > [0.7, 0.7, 0.52][boss.phaseIndex]) {
		resetPartOpacity(leftBattery, leftAlive)
		resetPartOpacity(rightBattery, rightAlive)
		return
	}
	const opacity = k.wave(0.28, 1, k.time() * 11)
	if (leftAlive) leftBattery.opacity = opacity
	if (rightAlive) rightBattery.opacity = opacity
}

function fireBroadsideVolley(
	boss: GameObj,
	leftMuzzle: GameObj,
	rightMuzzle: GameObj,
	leftAlive: boolean,
	rightAlive: boolean,
	extraTags?: string[],
	spreadOverride?: number[]
) {
	let side = boss.nextBattery as "left" | "right"
	if (side === "left" && !leftAlive) side = "right"
	if (side === "right" && !rightAlive) side = "left"
	if (side === "left" && !leftAlive) return
	if (side === "right" && !rightAlive) return
	const muzzle = side === "left" ? leftMuzzle : rightMuzzle
	const origin = muzzle.worldPos.clone()
	const baseDirection = directionToPlayer(origin)
	const spread = spreadOverride ?? (
		boss.phaseIndex === 0
			? [-13, 0, 13]
			: boss.phaseIndex === 1
				? [-18, -6, 6, 18]
				: [-20, -10, 0, 10, 20]
	)
	spread.forEach((angle, index) => {
		const direction = k.Vec2.fromAngle(baseDirection.angle() + angle)
		spawnClaimkeeperProjectile(
			origin,
			direction,
			boss.damage,
			boss.phaseIndex === 2 ? 0.56 : 0.5,
			index === 0,
			extraTags
		)
	})
	boss.nextBattery = side === "left" ? "right" : "left"
}

function fireReactorRing(boss: GameObj, extraTags?: string[]) {
	const projectileCount = 14
	const playerAngle = directionToPlayer(boss.pos).angle()
	const safeCenter = playerAngle + (boss.ringIndex - 1) * 24
	let soundPlayed = false
	for (let index = 0; index < projectileCount; index++) {
		const angle = index * (360 / projectileCount)
		if (Math.abs(shortestAngleDelta(angle, safeCenter)) < 38) continue
		const direction = k.Vec2.fromAngle(angle)
		spawnClaimkeeperProjectile(
			boss.pos.add(direction.scale(24 * boss.baseScale)),
			direction,
			boss.damage,
			0.43,
			!soundPlayed,
			extraTags
		)
		soundPlayed = true
	}
	k.shake(2.5)
}

function spawnClaimkeeperProjectile(
	pos: Vec2,
	direction: Vec2,
	damage: number,
	speedMultiplier: number,
	playSound: boolean,
	extraTags?: string[]
) {
	return spawnProjectile({
		pos: pos.clone(),
		dir: direction,
		rotation: direction.angle() + 90,
		sprite: "bullet1",
		tint: k.WHITE,
		speed: BULLET_SPEED,
		speedMultiplier,
		tags: [
			tags.enemy,
			tags.blaster,
			CLAIMKEEPER_ATTACK_TAG,
			...(extraTags ?? []),
		],
		impact: { damage },
		lifespan: { duration: 5 },
		fireSound: playSound ? "shoot1" : undefined,
		damageSource: {
			name: "THE CLAIMKEEPER",
			sprite: "boss1_body",
		},
	})
}

function resolveBossProjectileHits(
	boss: GameObj,
	parts: TargetableBossPart[]
) {
	checkProjectileIntersection(boss.pos, boss.hb, tags.friendly, (projectile) => {
		for (const part of parts) {
			if (!part.isAlive() || !part.obj.exists() || part.obj.hidden) continue
			if (projectile.pos.dist(part.obj.worldPos) > part.hitbox) continue
			onEnemyHit(part.obj, projectile)
			return
		}
		if (projectile.pos.dist(boss.pos) <= BODY_HITBOX * boss.baseScale) {
			onEnemyHit(boss, projectile)
		}
	})
}

function destroyBossPart(
	part: GameObj,
	sprite: string,
	boss: GameObj,
	maxHealth: number,
	scale: number
) {
	const worldPos = part.worldPos.clone()
	part.hidden = true
	part.paused = true
	detach(worldPos, sprite, 75 * scale)
	starsEmitter.emitter.position = worldPos
	starsEmitter.emit(28)
	audioService.playSound(randomExplosion(), { volume: subSoundVolume * 0.9 })
	boss.jitter(10)
	k.shake(5)
	if (boss.exists() && boss.hp > 0) {
		applyDamage(boss, maxHealth * 0.075, {
			position: worldPos,
			showNumber: false,
		})
	}
}

function spawnBossPhasePulse(pos: Vec2, scale: number, phaseIndex: number) {
	const pulse = k.add([
		k.pos(pos),
		k.circle(28 * scale, { fill: false }),
		k.outline(3, k.WHITE),
		k.anchor("center"),
		k.opacity(0.9),
		k.scale(1),
		k.animate(),
		k.lifespan(0.65, { fade: 0.35 }),
		tags.gameLoop,
	])
	pulse.animate("scale", [k.vec2(1), k.vec2(3.8 + phaseIndex)], {
		duration: 0.65,
		easing: k.easings.easeOutCubic,
	})
}

function directionToPlayer(pos: Vec2) {
	const delta = playerObj.pos.sub(pos)
	return delta.len() > 0 ? delta.unit() : k.vec2(0, 1)
}

function shortestAngleDelta(from: number, to: number) {
	return ((to - from + 540) % 360) - 180
}
