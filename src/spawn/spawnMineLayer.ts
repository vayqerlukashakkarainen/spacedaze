import type { GameObj, Vec2 } from "kaplay"
import { snareable } from "../comp/snareable"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, layers, mainSoundVolume, velocityScale } from "../main"
import { gameSoundService } from "../services/audio/gameSoundService"
import { grantUltimateChargeForDestruction } from "../services/abilities/ultimateAbilityService"
import { applyDamage } from "../services/combat/damageService"
import { applyDefaultExplosionForce } from "../services/combat/explosionPulseService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { damageDestructibleWallsInRadius } from "../services/world/destructibleWallService"
import { getEnemyNavigationDirection } from "../services/enemies/enemyNavigationService"
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState"
import { isEnemyEmpDisrupted } from "../services/enemies/enemyEmpService"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/enemies/threatService"
import {
	applyDirectionalSteeringLean,
	easeDirection,
	registerHitAnimation,
} from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { spawnExplosiveBarrelExplosionEffect } from "./spawnFlash"

const ENEMY_MINE_WARNING_RADIUS = 96
const ENEMY_MINE_TRIGGER_RADIUS = 34
const MINE_LAYER_VISUAL = getEnemyVisual("mine-layer")
const ENEMY_MINE_VISUAL = getEnemyVisual("enemy-proximity-mine")

export function spawnMineLayer(
	pos: Vec2,
	hp = 5,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, MINE_LAYER_VISUAL.worldScale, options)
	const mineLayer = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(MINE_LAYER_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 15 * profile.scale,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.mineLayer,
			mineTimer: k.rand(0.6, 1.4),
			orbitDirection: k.chance(0.5) ? 1 : -1,
			moveDirection: k.vec2(0, 1),
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleController,
		tags.enemyRoleTerrain,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerHitAnimation(mineLayer)
	registerBatchedEntityUpdate("enemies", mineLayer, () => {
		const delta = k.dt() * mineLayer.getTimescale()
		const toPlayer = playerObj.pos.sub(mineLayer.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const tangent = k.vec2(-direction.y, direction.x).scale(mineLayer.orbitDirection)
		const radial = distance < 185
			? direction.scale(-1)
			: distance > 275
				? direction
				: k.vec2(0)
		const movement = tangent.add(radial.scale(1.25))
		if (movement.len() > 0) {
			const desiredDirection = getEnemyNavigationDirection(
				mineLayer,
				movement.unit(),
				playerObj.pos
			)
			mineLayer.moveDirection = easeDirection(
				mineLayer.moveDirection,
				desiredDirection,
				4,
				delta
			)
			mineLayer.move(
				mineLayer.moveDirection.scale(
					85 * profile.speedMultiplier * velocityScale() * mineLayer.getTimescale()
				)
			)
			mineLayer.angle = mineLayer.moveDirection.angle() + 90
			applyDirectionalSteeringLean(
				mineLayer,
				mineLayer.moveDirection,
				desiredDirection,
				profile.scale
			)
		}

		mineLayer.mineTimer -= delta
		if (
			!isEnemyEmpDisrupted(mineLayer) &&
			mineLayer.mineTimer <= 0 &&
			distance < 440
		) {
			spawnEnemyMine(
				mineLayer.pos.clone(),
				mineLayer.damage,
				options.tags
			)
			gameSoundService.playPositional("lay_mine", mineLayer.pos.clone(), {
				volume: mainSoundVolume * 0.7,
				detune: k.rand(-35, 35),
				minDistance: 45,
				maxDistance: 540,
				panDistance: 260,
			})
			mineLayer.mineTimer = profile.elite ? 2 : 2.8
		}

		checkProjectileIntersection(mineLayer.pos, mineLayer.hb, tags.friendly, (projectile) => {
			onEnemyHit(mineLayer, projectile)
		})
		if (
			!isEnemyEmpDisrupted(mineLayer) &&
			!isPlayerDamageInvulnerable() &&
			mineLayer.pos.dist(playerObj.pos) < mineLayer.hb + 8
		) {
			applyDamage(playerObj, mineLayer.damage, {
				position: mineLayer.pos,
				source: { name: "MINE LAYER", sprite: "enemy_mine_layer" },
			})
			applyDamage(mineLayer, mineLayer.hp)
		}
	})

	mineLayer.onDeath(() => {
		enemyOnDeath(
			mineLayer.pos,
			6 * profile.rewardMultiplier,
			1.3 * profile.rewardMultiplier,
			"enemy",
			true,
			{
				tier: profile.elite ? "elite" : "normal",
				material: "ship",
			},
			mineLayer
		)
		k.destroy(mineLayer)
	})
	mineLayer.onHurt(() => {
		mineLayer.animation.seek(0)
	})

	return mineLayer
}

function spawnEnemyMine(pos: Vec2, damage: number, extraTags?: string[]) {
	let triggered = false
	const mine = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(ENEMY_MINE_VISUAL)),
		k.anchor("center"),
		k.layer(layers.gameEffects),
		k.rotate(k.rand(360)),
		k.scale(ENEMY_MINE_VISUAL.worldScale),
		k.color(k.WHITE),
		k.opacity(0.9),
		k.health(1),
		snareable({
			mass: 0.45,
			radius: 10,
			releaseDrag: 1.25,
		}),
		{
			armedElapsed: 0,
			triggerElapsed: 0,
			lifeSpan: 0,
			detonated: false,
		},
		tags.props,
		tags.roomVolatile,
		tags.gameLoop,
		...(extraTags ?? []),
	])
	mine.onDeath(() => detonateEnemyMine(mine, damage))

	registerBatchedEntityUpdate("world", mine, () => {
		const delta = k.dt()
		mine.armedElapsed += delta
		mine.lifeSpan += delta
		mine.angle += delta * 24
		if (mine.lifeSpan >= 12) {
			k.destroy(mine)
			return
		}
		if (mine.armedElapsed < 0.65) return
		const playerDistance = mine.pos.dist(playerObj.pos)
		const warningProgress = k.clamp(
			(ENEMY_MINE_WARNING_RADIUS - playerDistance) /
				(ENEMY_MINE_WARNING_RADIUS - ENEMY_MINE_TRIGGER_RADIUS),
			0,
			1
		)
		mine.color = triggered
			? k.rgb(255, 55, 55)
			: k.rgb(
				k.lerp(255, 255, warningProgress),
				k.lerp(255, 65, warningProgress),
				k.lerp(255, 65, warningProgress)
			)
		mine.opacity = triggered
			? k.wave(0.3, 1, k.time() * 14)
			: k.wave(
				k.lerp(0.6, 0.42, warningProgress),
				1,
				k.time() * k.lerp(4, 10, warningProgress)
			)

		if (!triggered && playerDistance < ENEMY_MINE_TRIGGER_RADIUS) triggered = true
		checkProjectileIntersection(mine.pos, 10, tags.friendly, (projectile) => {
			if (projectile.exists()) k.destroy(projectile)
			triggered = true
			mine.triggerElapsed = 0.22
		})
		if (!triggered) return
		mine.triggerElapsed += delta
		if (mine.triggerElapsed < 0.32) return
		detonateEnemyMine(mine, damage)
	})
}

function detonateEnemyMine(mine: GameObj, damage: number) {
	if (mine.detonated) return
	mine.detonated = true
	const explosionPos = mine.pos.clone()
	grantUltimateChargeForDestruction("environment", explosionPos)
	damageDestructibleWallsInRadius(explosionPos, 52, damage, {
		explosive: true,
	})
	if (
		!isPlayerDamageInvulnerable() &&
		playerObj.exists() &&
		playerObj.pos.dist(explosionPos) <= 52
	) {
		applyDamage(playerObj, damage, {
			position: explosionPos,
			source: { name: "MINE LAYER", sprite: "room_proximity_mine" },
		})
	}
	applyDefaultExplosionForce(explosionPos, 52, { excludeIds: [mine.id] })
	spawnExplosiveBarrelExplosionEffect(explosionPos, 52)
	gameSoundService.playPositional("explosive_blast", explosionPos, {
		volume: mainSoundVolume * 0.8,
		maxDistance: 650,
	})
	k.destroy(mine)
}
