import type { GameObj, PosComp, Vec2 } from "kaplay"
import { detach } from "../compose"
import { jitter } from "../comp/jitter"
import { timescale } from "../comp/timescale"
import {
	checkProjectileIntersection,
	getProjectileSweepIntersection,
	playerObj,
	resolveProjectileSweepHit,
} from "../game"
import {
	BULLET_SPEED,
	k,
	layers,
	mainSoundVolume,
	velocityScale,
} from "../main"
import { sparkEmitter, starsEmitter } from "../particles"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBossEncounter } from "../services/enemies/bossEncounterService"
import { getBossDefinition } from "../services/enemies/bossRegistry"
import { applyDamage } from "../services/combat/damageService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { isEnemyEmpDisrupted } from "../services/enemies/enemyEmpService"
import { setHitSoundProfile } from "../services/audio/hitSoundService"
import { registerShipPartTarget } from "../services/combat/targetingService"
import { hasEnemyLineOfSight } from "../services/enemies/enemyNavigationService"
import { spawnLineTelegraph } from "../services/enemies/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState"
import { spawnProjectile } from "../services/combat/projectileService"
import { drawLightning } from "../services/combat/lightningVisualService"
import {
	startShipPartDamageSmoke,
	triggerShipPartExplosion,
} from "../services/combat/shipPartDamageService"
import { registerPullableShipPart } from "../services/combat/shipPartPullService"
import { ENEMY_THREAT_RANK } from "../services/enemies/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { spawnGravityPull } from "./spawnGravityPull"

const BODY_HITBOX = 62
const BATTERY_HITBOX = 19
const CROWN_HITBOX = 17
const BOSS_MOVEMENT_RADIUS = 105
const BOSS_STAGGER_DURATION = 0.48
const CLAIMKEEPER_ATTACK_TAG = "claimkeeperAttack"
const DREADNOUGHT_VISUAL = getEnemyVisual("federation-dreadnought")
const CLAIMKEEPER_BODY_SPRITES = DREADNOUGHT_VISUAL.phaseSprites ??
	DREADNOUGHT_VISUAL.parts.map((part) => part.sprite)
const CLAIMKEEPER_LEFT_BATTERY = DREADNOUGHT_VISUAL.parts[1]
const CLAIMKEEPER_RIGHT_BATTERY = DREADNOUGHT_VISUAL.parts[2]
const CLAIMKEEPER_CROWN = DREADNOUGHT_VISUAL.parts[3]

type DreadnoughtState =
	| "entry"
	| "stagger"
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
	obj: GameObj<PosComp>
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
	const worldScale = DREADNOUGHT_VISUAL.worldScale * scale
	const leftBatteryOffset = k.vec2(
		...(CLAIMKEEPER_LEFT_BATTERY.offset ?? [-50, -5])
	)
	const rightBatteryOffset = k.vec2(
		...(CLAIMKEEPER_RIGHT_BATTERY.offset ?? [50, -5])
	)
	const crownOffset = k.vec2(...(CLAIMKEEPER_CROWN.offset ?? [0, -37]))
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
		k.scale(worldScale),
		jitter(),
		timescale(),
		{
			hb: BODY_HITBOX * worldScale,
			threatRank: ENEMY_THREAT_RANK.boss,
			baseScale: worldScale,
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
			movementTarget: arenaAnchor.clone(),
			moveVelocity: k.vec2(0, 0),
			recoilVelocity: k.vec2(0, 0),
			strafeDirection: k.chance(0.5) ? -1 : 1,
			lastStaggerEffectAt: Number.NEGATIVE_INFINITY,
			damage: 1,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.boss,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(boss, "heavyMetal")
	if (options.skipEntry) {
		boss.movementTarget = pickBossRecoveryTarget(
			boss,
			arenaAnchor,
			boss.strafeDirection
		)
	}

	const leftBattery = boss.add([
		k.pos(leftBatteryOffset),
		k.sprite(CLAIMKEEPER_LEFT_BATTERY.sprite),
		k.anchor("center"),
		k.health(5 * Math.max(8, Math.round(hp / 5 * 0.18))),
		k.animate(),
		k.opacity(options.skipEntry ? 1 : 0),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		{ recoilAmount: 0, detachImpactDirection: undefined as Vec2 | undefined },
		tags.part,
		tags.gameLoop,
	])
	const leftMuzzle = leftBattery.add([
		k.pos(muzzleOffset),
		k.anchor("center"),
	])
	const rightBattery = boss.add([
		k.pos(rightBatteryOffset),
		k.sprite(CLAIMKEEPER_RIGHT_BATTERY.sprite),
		k.anchor("center"),
		k.health(5 * Math.max(8, Math.round(hp / 5 * 0.18))),
		k.animate(),
		k.opacity(options.skipEntry ? 1 : 0),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		{ recoilAmount: 0, detachImpactDirection: undefined as Vec2 | undefined },
		tags.part,
		tags.gameLoop,
	])
	const rightMuzzle = rightBattery.add([
		k.pos(muzzleOffset),
		k.anchor("center"),
	])
	const crown = boss.add([
		k.pos(crownOffset),
		k.sprite(CLAIMKEEPER_CROWN.sprite),
		k.anchor("center"),
		k.health(5 * Math.max(7, Math.round(hp / 5 * 0.15))),
		k.animate(),
		k.opacity(options.skipEntry ? 1 : 0),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		{ detachImpactDirection: undefined as Vec2 | undefined },
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
			hitbox: BATTERY_HITBOX * worldScale,
			isAlive: () => leftBatteryAlive,
		},
		{
			obj: rightBattery,
			hitbox: BATTERY_HITBOX * worldScale,
			isAlive: () => rightBatteryAlive,
		},
		{
			obj: crown,
			hitbox: CROWN_HITBOX * worldScale,
			isAlive: () => crownAlive,
		},
	]
	for (const part of targetableParts) {
		registerShipPartTarget(part.obj, boss, part.hitbox)
	}

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
		boss.strafeDirection *= -1
		boss.movementTarget = pickBossRecoveryTarget(
			boss,
			arenaAnchor,
			boss.strafeDirection
		)
		stopActiveField()
		resetPartOpacity(leftBattery, leftBatteryAlive)
		resetPartOpacity(rightBattery, rightBatteryAlive)
		resetPartOpacity(crown, crownAlive)
	}

	const beginLance = () => {
		boss.combatState = "lanceTelegraph"
		boss.stateTimer = 0
		boss.lockedDirection = directionToPlayer(boss.pos)
		boss.movementTarget = clampBossMovementTarget(
			arenaAnchor,
			boss.pos.sub(boss.lockedDirection.scale(82))
		)
		const duration = [0.84, 0.72, 0.58][boss.phaseIndex]
		spawnLineTelegraph(
			boss.pos.clone(),
			boss.pos.add(boss.lockedDirection.scale(900)),
			{
				duration,
				tags: [CLAIMKEEPER_ATTACK_TAG, ...(options.tags ?? [])],
				getStart: () => boss.exists() ? boss.pos.clone() : undefined,
				getEnd: () => boss.exists()
					? boss.pos.add(boss.lockedDirection.scale(900))
					: undefined,
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
		gameSoundService.playPositional(
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
		boss.movementTarget = getBossApproachTarget(arenaAnchor, playerObj.pos)
		attackRing.pos = crownOffset.clone()
		attackRing.scale = k.vec2(0.2)
		attackRing.opacity = 0.85
		gameSoundService.playPositional(
			"wormhole_ambience",
			() => crown.exists() ? crown.worldPos : undefined,
			{ volume: mainSoundVolume * 0.22, voiceLimit: 1 }
		)
	}

	const beginReactor = () => {
		boss.combatState = "reactorCharge"
		boss.stateTimer = 0
		boss.shotTimer = 0
		boss.movementTarget = arenaAnchor.clone()
		boss.ringIndex = 0
		attackRing.pos = k.vec2(0, 0)
		attackRing.scale = k.vec2(0.12)
		attackRing.opacity = 0.95
		gameSoundService.playPositional(
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

	const staggerBoss = (origin: Vec2, duration = BOSS_STAGGER_DURATION) => {
		if (!boss.exists() || defeated) return
		const showFeedback = k.time() - boss.lastStaggerEffectAt > 0.08
		boss.combatState = "stagger"
		boss.stateTimer = 0
		boss.recoveryDuration = duration
		boss.shotsRemaining = 0
		boss.shotTimer = 0
		boss.moveVelocity = boss.moveVelocity.scale(0.22)
		const away = boss.pos.sub(origin)
		if (away.len() > 0.001) {
			boss.recoilVelocity = boss.recoilVelocity.add(away.unit().scale(34))
		}
		stopActiveField()
		resetPartOpacity(leftBattery, leftBatteryAlive)
		resetPartOpacity(rightBattery, rightBatteryAlive)
		resetPartOpacity(crown, crownAlive)
		if (showFeedback) {
			boss.lastStaggerEffectAt = k.time()
			spawnBossStaggerEffect(boss, targetableParts, worldScale)
			sparkEmitter.emitter.position = origin
			sparkEmitter.emit(18)
		}
		boss.jitter(13)
		if (showFeedback) k.shake(5)
	}

	registerHitAnimation(boss)
	registerHitAnimation(leftBattery)
	registerHitAnimation(rightBattery)
	registerHitAnimation(crown)
	for (const part of [leftBattery, rightBattery, crown]) {
		part.onHurt(() => {
			part.animation.seek(0)
			startShipPartDamageSmoke(part, boss)
		})
	}
	let detachedLeftBattery: GameObj | undefined
	let detachedRightBattery: GameObj | undefined
	let detachedCrown: GameObj | undefined
	registerBossEncounter(boss, definition.id, {
		maxHealth: hp,
		onPhaseChanged: (_phase, phaseIndex) => {
			boss.phaseIndex = phaseIndex
			boss.use(k.sprite(CLAIMKEEPER_BODY_SPRITES[phaseIndex]))
			boss.attackCycle = 0
			if (phaseIndex === 0 || boss.combatState === "entry") return
			spawnBossPhasePulse(boss.pos, worldScale, phaseIndex)
			boss.jitter(7 + phaseIndex * 3)
			staggerBoss(boss.pos, 0.62)
		},
		onDefeated: options.onDefeated,
	})

	leftBattery.onDeath(() => {
		if (!leftBatteryAlive) return
		const breakPosition = leftBattery.worldPos.clone()
		leftBatteryAlive = false
		detachedLeftBattery = destroyBossPart(
			leftBattery,
			CLAIMKEEPER_LEFT_BATTERY.sprite,
			boss,
			hp,
			worldScale
		)
		staggerBoss(breakPosition)
	})
	rightBattery.onDeath(() => {
		if (!rightBatteryAlive) return
		const breakPosition = rightBattery.worldPos.clone()
		rightBatteryAlive = false
		detachedRightBattery = destroyBossPart(
			rightBattery,
			CLAIMKEEPER_RIGHT_BATTERY.sprite,
			boss,
			hp,
			worldScale
		)
		staggerBoss(breakPosition)
	})
	crown.onDeath(() => {
		if (!crownAlive) return
		const breakPosition = crown.worldPos.clone()
		crownAlive = false
		detachedCrown = destroyBossPart(
			crown,
			CLAIMKEEPER_CROWN.sprite,
			boss,
			hp,
			worldScale
		)
		staggerBoss(breakPosition, 0.58)
	})
	registerPullableShipPart(leftBattery, boss, BATTERY_HITBOX * worldScale, {
		pullForce: 125,
		pullDuration: 1.15,
		detach: (direction) => {
			if (!leftBatteryAlive) return undefined
			detachedLeftBattery = undefined
			leftBattery.detachImpactDirection = direction.clone()
			applyDamage(leftBattery, leftBattery.hp, {
				position: leftBattery.worldPos.clone(),
				showNumber: false,
			})
			return detachedLeftBattery
		},
	})
	registerPullableShipPart(rightBattery, boss, BATTERY_HITBOX * worldScale, {
		pullForce: 125,
		pullDuration: 1.15,
		detach: (direction) => {
			if (!rightBatteryAlive) return undefined
			detachedRightBattery = undefined
			rightBattery.detachImpactDirection = direction.clone()
			applyDamage(rightBattery, rightBattery.hp, {
				position: rightBattery.worldPos.clone(),
				showNumber: false,
			})
			return detachedRightBattery
		},
	})
	registerPullableShipPart(crown, boss, CROWN_HITBOX * worldScale, {
		pullForce: 145,
		pullDuration: 1.35,
		detach: (direction) => {
			if (!crownAlive) return undefined
			detachedCrown = undefined
			crown.detachImpactDirection = direction.clone()
			applyDamage(crown, crown.hp, {
				position: crown.worldPos.clone(),
				showNumber: false,
			})
			return detachedCrown
		},
	})

	registerBatchedEntityUpdate("enemies", boss, () => {
		const delta = k.dt() * velocityScale() * boss.getTimescale()
		const previousPos = boss.pos.clone()
		boss.stateTimer += delta
		boss.scale = k.vec2(
			boss.baseScale * k.wave(0.992, 1.008, k.time() * 1.7)
		)
		if (isEnemyEmpDisrupted(boss)) {
			gravity.strength = 0
			attackRing.opacity = 0
			resolveBossProjectileHits(boss, targetableParts)
			return
		}
		if (boss.combatState === "tractorPull") gravity.strength = 150

		if (boss.combatState === "entry") {
			boss.opacity = k.lerp(
				boss.opacity,
				1,
				1 - Math.exp(-4 * delta)
			)
			if (leftBatteryAlive) leftBattery.opacity = boss.opacity
			if (rightBatteryAlive) rightBattery.opacity = boss.opacity
			if (crownAlive) crown.opacity = boss.opacity
			moveBossToward(boss, arenaAnchor, 2.8, delta)
			if (boss.pos.dist(arenaAnchor) <= 3) {
				boss.pos = arenaAnchor.clone()
				boss.opacity = 1
				k.shake(4)
				enterRecovery(1.5)
			}
		} else if (boss.combatState === "stagger") {
			brakeBossMovement(boss, delta, 7.5)
			if (boss.stateTimer >= boss.recoveryDuration) enterRecovery(0.62)
		} else if (boss.combatState === "recover") {
			steerBossToward(
				boss,
				boss.movementTarget,
				50 + boss.phaseIndex * 8,
				3.2,
				delta
			)
			if (boss.stateTimer >= boss.recoveryDuration) beginNextAttack()
		} else if (boss.combatState === "broadside") {
			boss.movementTarget = getBossBroadsideTarget(
				arenaAnchor,
				playerObj.pos,
				boss.strafeDirection,
				boss.phaseIndex
			)
			steerBossToward(
				boss,
				boss.movementTarget,
				62 + boss.phaseIndex * 8,
				2.8,
				delta
			)
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
		} else if (boss.combatState === "lanceTelegraph") {
			steerBossToward(boss, boss.movementTarget, 48, 3.4, delta)
		} else if (boss.combatState === "lanceFire") {
			brakeBossMovement(boss, delta, 9)
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
						boss.pos.add(direction.scale(30 * worldScale)),
						direction,
						boss.damage,
						0.92,
						boss.shotsRemaining === 6 + boss.phaseIndex,
						options.tags
					)
					applyBossRecoil(
						boss,
						direction,
						boss.shotsRemaining === 6 + boss.phaseIndex ? 13 : 3.5
					)
					boss.shotsRemaining--
					boss.shotTimer = [0.13, 0.115, 0.1][boss.phaseIndex]
					if (boss.shotsRemaining === 0) enterRecovery(1.35)
				}
			}
		} else if (boss.combatState === "tractorCharge") {
			boss.movementTarget = getBossApproachTarget(arenaAnchor, playerObj.pos)
			steerBossToward(boss, boss.movementTarget, 44, 2.6, delta)
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
			brakeBossMovement(boss, delta, 5.5)
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
			steerBossToward(boss, arenaAnchor, 58, 3.6, delta)
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
			brakeBossMovement(boss, delta, 8)
			boss.shotTimer -= delta
			if (boss.shotTimer <= 0 && boss.shotsRemaining > 0) {
				fireReactorRing(boss, options.tags)
				boss.shotsRemaining--
				boss.ringIndex++
				boss.shotTimer = 0.46
				if (boss.shotsRemaining === 0) enterRecovery(1.55)
			}
		}

		integrateBossRecoil(boss, delta)
		updateBossBank(boss, previousPos, delta)
		faceBattery(leftBattery, leftBatteryAlive, playerObj.pos, delta, boss.angle)
		faceBattery(rightBattery, rightBatteryAlive, playerObj.pos, delta, boss.angle)
		updateBatteryRecoil(leftBattery, leftBatteryAlive, delta)
		updateBatteryRecoil(rightBattery, rightBatteryAlive, delta)
		gravity.pos = crownAlive ? crown.worldPos.clone() : boss.pos.clone()

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
			{ intensity: 4.5, starCount: 90, material: "ship" },
			boss
		)
		k.destroy(boss)
	})
	boss.onHurt(() => {
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

function steerBossToward(
	boss: GameObj,
	target: Vec2,
	maxSpeed: number,
	response: number,
	delta: number
) {
	const offset = target.sub(boss.pos)
	if (offset.len() <= 1) {
		brakeBossMovement(boss, delta, response)
		return
	}
	const desiredSpeed = Math.min(maxSpeed, offset.len() * 2.2)
	const desiredVelocity = offset.unit().scale(desiredSpeed)
	const blend = 1 - Math.exp(-response * delta)
	boss.moveVelocity = boss.moveVelocity.lerp(desiredVelocity, blend)
	boss.pos = boss.pos.add(boss.moveVelocity.scale(delta))
}

function brakeBossMovement(boss: GameObj, delta: number, response: number) {
	boss.moveVelocity = boss.moveVelocity.scale(Math.exp(-response * delta))
	boss.pos = boss.pos.add(boss.moveVelocity.scale(delta))
}

function integrateBossRecoil(boss: GameObj, delta: number) {
	boss.pos = boss.pos.add(boss.recoilVelocity.scale(delta))
	boss.recoilVelocity = boss.recoilVelocity.scale(Math.exp(-6.5 * delta))
}

function applyBossRecoil(boss: GameObj, direction: Vec2, force: number) {
	if (direction.len() <= 0.001) return
	boss.recoilVelocity = boss.recoilVelocity.sub(direction.unit().scale(force))
}

function clampBossMovementTarget(anchor: Vec2, target: Vec2) {
	const offset = target.sub(anchor)
	if (offset.len() <= BOSS_MOVEMENT_RADIUS) return target
	return anchor.add(offset.unit().scale(BOSS_MOVEMENT_RADIUS))
}

function pickBossRecoveryTarget(boss: GameObj, anchor: Vec2, side: number) {
	const toPlayer = playerObj.pos.sub(anchor)
	const baseDirection = toPlayer.len() > 0.001
		? toPlayer.unit()
		: k.vec2(0, 1)
	const tangent = baseDirection.normal().scale(side)
	const radius = 62 + boss.phaseIndex * 11
	return clampBossMovementTarget(
		anchor,
		anchor
			.add(tangent.scale(radius))
			.sub(baseDirection.scale(18 + boss.phaseIndex * 5))
	)
}

function getBossBroadsideTarget(
	anchor: Vec2,
	playerPosition: Vec2,
	side: number,
	phaseIndex: number
) {
	const toPlayer = playerPosition.sub(anchor)
	const baseDirection = toPlayer.len() > 0.001
		? toPlayer.unit()
		: k.vec2(0, 1)
	const tangent = baseDirection.normal().scale(side)
	return clampBossMovementTarget(
		anchor,
		anchor
			.add(tangent.scale(78 + phaseIndex * 9))
			.sub(baseDirection.scale(12))
	)
}

function getBossApproachTarget(anchor: Vec2, playerPosition: Vec2) {
	const toPlayer = playerPosition.sub(anchor)
	if (toPlayer.len() <= 0.001) return anchor.clone()
	return clampBossMovementTarget(anchor, anchor.add(toPlayer.unit().scale(82)))
}

function updateBossBank(boss: GameObj, previousPos: Vec2, delta: number) {
	if (delta <= 0.0001) return
	const lateralSpeed = (boss.pos.x - previousPos.x) / delta
	const desired = k.clamp(lateralSpeed * 0.065, -5.5, 5.5)
	const turn = shortestAngleDelta(boss.angle, desired)
	boss.angle += turn * (1 - Math.exp(-5.5 * delta))
}

function faceBattery(
	battery: GameObj,
	alive: boolean,
	target: Vec2,
	delta: number,
	ownerAngle: number
) {
	if (!alive || !battery.exists()) return
	const direction = target.sub(battery.worldPos)
	if (direction.len() <= 0) return
	const desired = direction.angle() + 90 - ownerAngle
	const turn = shortestAngleDelta(battery.angle, desired)
	battery.angle += turn * (1 - Math.exp(-7 * delta))
}

function updateBatteryRecoil(battery: GameObj, alive: boolean, delta: number) {
	if (!alive || !battery.exists()) return
	battery.recoilAmount *= Math.exp(-13 * delta)
	battery.scale = k.vec2(
		1 + battery.recoilAmount * 0.1,
		1 - battery.recoilAmount * 0.18
	)
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
	const battery = muzzle.parent
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
	if (battery) battery.recoilAmount = 1
	applyBossRecoil(boss, baseDirection, spreadOverride ? 3.5 : 5.5)
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
	applyBossRecoil(boss, directionToPlayer(boss.pos), 7)
	boss.jitter(5)
	k.shake(2.5)
}

function spawnBossStaggerEffect(
	boss: GameObj,
	parts: TargetableBossPart[],
	worldScale: number
) {
	const duration = 0.52
	const seed = k.rand(0, 1000)
	const hullPoints = [
		k.vec2(-34, -18),
		k.vec2(31, -11),
		k.vec2(-27, 25),
		k.vec2(25, 28),
	].map((point) => point.scale(worldScale))
	const effect = k.add([
		k.pos(boss.pos),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / duration, 0, 1)
				const opacity = 1 - progress
				const flickerFrame = Math.floor(this.elapsed * 34)
				if (flickerFrame % 3 === 1) return
				const cyan = k.rgb(75, 205, 255)
				const livePartPoints = parts
					.filter((part) => part.isAlive() && part.obj.exists())
					.map((part) => part.obj.worldPos.sub(this.pos))
				const points = [...livePartPoints, ...hullPoints]
				for (let index = 0; index < points.length; index++) {
					const start = index % 2 === 0 ? k.vec2() : points[index]
					const end = index % 2 === 0
						? points[index]
						: points[(index + 1) % points.length]
					drawLightning({
						start,
						end,
						color: index % 3 === 0 ? k.WHITE : cyan,
						branchColor: k.WHITE,
						opacity: opacity * 0.92,
						width: index % 2 === 0 ? 1.8 : 1.2,
						segmentLength: 6,
						amplitude: 8,
						waveCount: 2.4,
						smoothness: 0.08,
						flickerRate: 30,
						seed: seed + index * 23.7,
						branchChance: 0.18,
						branchLength: 8,
					})
				}
			},
		},
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("effects", effect, () => {
		if (!boss.exists()) {
			k.destroy(effect)
			return
		}
		effect.elapsed += k.dt()
		effect.pos = boss.pos.clone()
		if (effect.elapsed >= duration) k.destroy(effect)
	})
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
			const intersection = getProjectileSweepIntersection(
				projectile,
				part.obj.worldPos,
				part.hitbox
			)
			if (!intersection) continue
			resolveProjectileSweepHit(projectile, intersection, () => {
				onEnemyHit(part.obj, projectile)
			})
			return
		}
		const bodyIntersection = getProjectileSweepIntersection(
			projectile,
			boss.pos,
			BODY_HITBOX * boss.baseScale
		)
		if (bodyIntersection) {
			resolveProjectileSweepHit(projectile, bodyIntersection, () => {
				onEnemyHit(boss, projectile)
			})
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
	const outward = worldPos.sub(boss.pos)
	const impactDirection = part.detachImpactDirection?.len() > 0.001
		? part.detachImpactDirection.unit()
		: undefined
	const detachDirection = impactDirection
		? outward.unit().scale(0.72).add(impactDirection.scale(0.58)).unit()
		: outward.len() > 0.001 ? outward.unit() : undefined
	const detachedPart = detach(worldPos, sprite, {
		force: 75 * scale,
		direction: detachDirection,
		angle: boss.angle + (part.angle ?? 0),
		scale,
		secondaryBurst: true,
	})
	starsEmitter.emitter.position = worldPos
	starsEmitter.emit(28)
	boss.jitter(10)
	triggerShipPartExplosion(part, boss, worldPos, {
		damage: maxHealth * 0.075,
		excludeIds: [boss.id],
	})
	if (boss.exists() && boss.hp > 0) {
		applyDamage(boss, maxHealth * 0.075, {
			position: worldPos,
			showNumber: false,
		})
	}
	return detachedPart
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
