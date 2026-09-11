import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { snareable } from "../../comp/snareable"
import { timescale } from "../../comp/timescale"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyDamage } from "../../services/combat/damageService"
import { applyDefaultExplosionForce } from "../../services/combat/explosionPulseService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	getEnemyNavigationDirection,
} from "../../services/enemies/enemyNavigationService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../../services/enemies/threatService"
import { isPlayerDamageInvulnerable } from "../../services/player/playerDamageState"
import { damageDestructibleWallsInRadius } from "../../services/world/destructibleWallService"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { onEnemyHit } from "../enemyShared"
import { spawnExplosiveBarrelExplosionEffect } from "../spawnFlash"
import {
	addWakeEnemyPart,
	composeWakeEnemy,
	handleWakeCompositeCombat,
	updateWakeEnemyMalfunction,
} from "./wakeEnemyShared"

type FuseRatPhase = "seek" | "prime" | "cooldown" | "disabled"

const FUSE_RAT_VISUAL = getEnemyVisual("wake-fuse-rat")
const FUSE_SEARCH_RADIUS = 520
const FUSE_PRIME_RANGE = 24
const FUSE_PRIME_DURATION = 1.45
const FUSE_MINE_TRIGGER_RADIUS = 32
const FUSE_MINE_DAMAGE_RADIUS = 52

export function spawnFuseRat(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		FUSE_RAT_VISUAL.worldScale,
		options
	)
	const [coreVisual, overchargerVisual] = FUSE_RAT_VISUAL.parts
	const toPlayer = playerObj.pos.sub(pos)
	const initialDirection = toPlayer.len() > 0
		? toPlayer.unit()
		: k.vec2(0, -1)
	const rat = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(initialDirection.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 10 * profile.scale,
			damage: profile.damage,
			phase: "seek" as FuseRatPhase,
			phaseTimer: 0,
			targetTimer: 0,
			mineTimer: k.rand(2.2, 3.8),
			batteryOperational: true,
			moveDirection: initialDirection,
			sabotageTarget: undefined as GameObj | undefined,
			draw() {
				if (
					this.phase !== "prime" ||
					!this.batteryOperational ||
					!this.sabotageTarget?.exists()
				) return
				const offset = this.sabotageTarget.pos.sub(this.pos).rotate(-this.angle)
				const localTarget = k.vec2(
					offset.x / this.scale.x,
					offset.y / this.scale.y
				)
				k.drawLine({
					p1: k.vec2(),
					p2: localTarget,
					width: 1,
					color: k.rgb(90, 225, 225),
					opacity: k.wave(0.3, 0.9, k.time() * 11),
				})
			},
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleSupport,
		tags.enemyRoleTerrain,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const overcharger = addWakeEnemyPart(
		rat,
		overchargerVisual.sprite,
		2 * Math.max(2, Math.round(profile.hp / 2 * 0.55))
	)
	composeWakeEnemy(rat, profile, [{
		obj: overcharger,
		hitbox: 6 * profile.scale,
		hitboxOffset: k.vec2(0, 0).scale(profile.scale),
		pullForce: 80,
		pullDuration: 0.65,
		onDestroyed: () => disableFuseRat(rat),
	}], 6, 1.2)

	registerBatchedEntityUpdate("enemies", rat, () => {
		const delta = k.dt() * rat.getTimescale()
		if (updateWakeEnemyMalfunction(rat, delta)) return
		rat.phaseTimer += delta
		rat.targetTimer -= delta
		rat.mineTimer -= delta

		if (rat.phase === "prime") {
			updateFuseRatPriming(rat)
		} else if (rat.phase === "disabled") {
			moveDisabledFuseRat(rat, profile, delta)
		} else if (rat.phase === "cooldown") {
			moveFuseRatAroundPlayer(rat, profile, delta)
			if (rat.phaseTimer >= 1.2) {
				rat.phase = "seek"
				rat.phaseTimer = 0
			}
		} else {
			updateFuseRatSeeking(rat, profile, delta, options.tags)
		}

		handleWakeCompositeCombat(
			rat,
			"FUSE RAT",
			"enemy_wake_fuse_rat_core"
		)
	})
	rat.onDestroy(() => releaseSabotageTarget(rat))

	return rat
}

function updateFuseRatSeeking(
	rat: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	delta: number,
	extraTags?: string[]
) {
	if (
		rat.targetTimer <= 0 ||
		!rat.sabotageTarget?.exists() ||
		rat.sabotageTarget.fuseRatClaimedBy !== rat.id
	) {
		releaseSabotageTarget(rat)
		rat.sabotageTarget = findSabotageTarget(rat)
		if (rat.sabotageTarget) rat.sabotageTarget.fuseRatClaimedBy = rat.id
		rat.targetTimer = 0.38
	}

	if (rat.sabotageTarget?.exists()) {
		const offset = rat.sabotageTarget.pos.sub(rat.pos)
		const direction = offset.len() > 0 ? offset.unit() : rat.moveDirection
		if (offset.len() <= FUSE_PRIME_RANGE * profile.scale) {
			startFuseRatPriming(rat)
			return
		}
		const navigationDirection = getEnemyNavigationDirection(
			rat,
			direction,
			rat.sabotageTarget.pos
		)
		rat.moveDirection = easeDirection(
			rat.moveDirection,
			navigationDirection,
			5.6,
			delta
		)
		rat.move(rat.moveDirection.scale(
			122 * profile.speedMultiplier * velocityScale() * rat.getTimescale()
		))
		rat.angle = rat.moveDirection.angle() + 90
		return
	}

	moveFuseRatAroundPlayer(rat, profile, delta)
	if (rat.mineTimer > 0) return
	spawnFuseMine(
		rat.pos.clone(),
		profile.damage * (profile.elite ? 1.15 : 0.8),
		(extraTags ?? []).filter((tag) => tag !== tags.runRoomEnemy)
	)
	rat.mineTimer = profile.elite ? 3.4 : 4.8
}

function moveFuseRatAroundPlayer(
	rat: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	delta: number
) {
	const toPlayer = playerObj.pos.sub(rat.pos)
	const distance = toPlayer.len()
	const direction = distance > 0 ? toPlayer.unit() : rat.moveDirection
	const tangent = direction.normal().scale(rat.id % 2 === 0 ? 1 : -1)
	const radial = distance < 170
		? direction.scale(-0.85)
		: distance > 270
			? direction.scale(0.65)
			: k.vec2(0)
	const desired = tangent.add(radial)
	const navigationDirection = getEnemyNavigationDirection(
		rat,
		desired.len() > 0 ? desired.unit() : direction,
		playerObj.pos
	)
	rat.moveDirection = easeDirection(
		rat.moveDirection,
		navigationDirection,
		5,
		delta
	)
	rat.move(rat.moveDirection.scale(
		105 * profile.speedMultiplier * velocityScale() * rat.getTimescale()
	))
	rat.angle = rat.moveDirection.angle() + 90
}

function moveDisabledFuseRat(
	rat: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	delta: number
) {
	const fromPlayer = rat.pos.sub(playerObj.pos)
	const direction = fromPlayer.len() > 0 ? fromPlayer.unit() : rat.moveDirection
	const navigationDirection = getEnemyNavigationDirection(
		rat,
		direction,
		rat.pos.add(direction.scale(220))
	)
	rat.moveDirection = easeDirection(
		rat.moveDirection,
		navigationDirection,
		6,
		delta
	)
	rat.move(rat.moveDirection.scale(
		138 * profile.speedMultiplier * velocityScale() * rat.getTimescale()
	))
	rat.angle = rat.moveDirection.angle() + 90
}

function findSabotageTarget(rat: GameObj) {
	return (k.get(tags.roomVolatile) as GameObj[])
		.filter((target) =>
			target.exists() &&
			typeof target.hp === "number" &&
			target.hp > 0 &&
			target.exploding !== true &&
			(target.fuseRatClaimedBy === undefined ||
				target.fuseRatClaimedBy === rat.id) &&
			target.pos.dist(rat.pos) <= FUSE_SEARCH_RADIUS
		)
		.sort((a, b) => a.pos.dist(rat.pos) - b.pos.dist(rat.pos))[0]
}

function startFuseRatPriming(rat: any) {
	const target = rat.sabotageTarget as GameObj | undefined
	if (!target?.exists()) return
	rat.phase = "prime"
	rat.phaseTimer = 0
	rat.moveDirection = k.vec2(0, 0)
	const targetMaxHealth = typeof target.maxHP === "number"
		? target.maxHP
		: target.hp
	const initialDamage = Math.max(1, targetMaxHealth * 0.46)
	applyDamage(target, initialDamage, {
		position: target.pos,
		showNumber: false,
	})
}

function updateFuseRatPriming(rat: any) {
	const target = rat.sabotageTarget as GameObj | undefined
	if (!rat.batteryOperational || !target?.exists()) {
		releaseSabotageTarget(rat)
		rat.phase = rat.batteryOperational ? "seek" : "disabled"
		rat.phaseTimer = 0
		return
	}
	const direction = target.pos.sub(rat.pos)
	if (direction.len() > 0.001) rat.angle = direction.angle() + 90
	rat.opacity = k.wave(0.55, 1, k.time() * 13)
	if (rat.phaseTimer < FUSE_PRIME_DURATION) return
	applyDamage(target, Math.max(1, target.hp + 1), {
		position: target.pos,
		showNumber: false,
	})
	releaseSabotageTarget(rat)
	rat.phase = "cooldown"
	rat.phaseTimer = 0
	rat.opacity = 1
}

function disableFuseRat(rat: any) {
	rat.batteryOperational = false
	releaseSabotageTarget(rat)
	rat.phase = "disabled"
	rat.phaseTimer = 0
	rat.opacity = 1
}

function releaseSabotageTarget(rat: any) {
	const target = rat.sabotageTarget as GameObj | undefined
	if (target?.exists() && target.fuseRatClaimedBy === rat.id) {
		target.fuseRatClaimedBy = undefined
	}
	rat.sabotageTarget = undefined
}

function spawnFuseMine(pos: Vec2, damage: number, extraTags: string[]) {
	let detonated = false
	const mine = k.add([
		k.pos(pos),
		k.sprite("room_proximity_mine"),
		k.anchor("center"),
		k.layer(layers.gameEffects),
		k.rotate(k.rand(360)),
		k.scale(0.68),
		k.color(k.WHITE),
		k.opacity(0.82),
		k.health(2),
		k.animate(),
		timescale(),
		snareable({
			mass: 0.45,
			radius: 10,
			releaseDrag: 1.25,
		}),
		{
			hb: 9,
			armedElapsed: 0,
			lifeSpan: 0,
		},
		tags.enemy,
		tags.props,
		tags.unit,
		tags.enemyRoleTerrain,
		tags.gameLoop,
		...extraTags,
	])

	registerBatchedEntityUpdate("world", mine, () => {
		const delta = k.dt() * mine.getTimescale()
		mine.armedElapsed += delta
		mine.lifeSpan += delta
		mine.angle += 35 * delta
		if (mine.lifeSpan >= 11) {
			k.destroy(mine)
			return
		}
		mine.opacity = mine.armedElapsed < 0.6
			? 0.45
			: k.wave(0.42, 1, k.time() * 9)
		checkProjectileIntersection(mine.pos, mine.hb, tags.friendly, (projectile) => {
			onEnemyHit(mine, projectile)
		})
		if (
			mine.armedElapsed >= 0.6 &&
			playerObj.exists() &&
			playerObj.pos.dist(mine.pos) <= FUSE_MINE_TRIGGER_RADIUS
		) {
			detonateFuseMine(mine, damage)
		}
	})
	mine.onDeath(() => detonateFuseMine(mine, damage))

	function detonateFuseMine(targetMine: GameObj, mineDamage: number) {
		if (detonated) return
		detonated = true
		const explosionPos = targetMine.pos.clone()
		damageDestructibleWallsInRadius(
			explosionPos,
			FUSE_MINE_DAMAGE_RADIUS,
			mineDamage,
			{ explosive: true }
		)
		if (
			!isPlayerDamageInvulnerable() &&
			playerObj.exists() &&
			playerObj.pos.dist(explosionPos) <= FUSE_MINE_DAMAGE_RADIUS
		) {
			applyDamage(playerObj, mineDamage, {
				position: explosionPos,
				source: {
					name: "FUSE RAT MINE",
					sprite: "enemy_wake_fuse_rat_core",
				},
			})
		}
		applyDefaultExplosionForce(explosionPos, FUSE_MINE_DAMAGE_RADIUS, {
			excludeIds: [targetMine.id],
		})
		spawnExplosiveBarrelExplosionEffect(
			explosionPos,
			FUSE_MINE_DAMAGE_RADIUS
		)
		gameSoundService.playPositional("explosive_blast", explosionPos, {
			volume: mainSoundVolume * 0.62,
			maxDistance: 620,
		})
		if (targetMine.exists()) k.destroy(targetMine)
	}
}
