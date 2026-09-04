import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, layers, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { spawnExplosionEffect } from "./spawnFlash"

export function spawnMineLayer(
	pos: Vec2,
	hp = 5,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 1, options)
	const mineLayer = k.add([
		k.pos(pos),
		k.sprite("enemy_mine_layer"),
		k.color(255, profile.elite ? 205 : 170, 55),
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
			mineTimer: k.rand(0.6, 1.4),
			orbitDirection: k.chance(0.5) ? 1 : -1,
		},
		tags.enemy,
		tags.unit,
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
			mineLayer.move(
				movement.unit().scale(
					85 * profile.speedMultiplier * velocityScale() * mineLayer.getTimescale()
				)
			)
			mineLayer.angle = movement.angle() + 90
		}

		mineLayer.mineTimer -= delta
		if (mineLayer.mineTimer <= 0 && distance < 440) {
			spawnEnemyMine(
				mineLayer.pos.clone(),
				profile.damage,
				options.tags
			)
			mineLayer.mineTimer = profile.elite ? 2 : 2.8
		}

		checkProjectileIntersection(mineLayer.pos, mineLayer.hb, tags.friendly, (projectile) => {
			onEnemyHit(mineLayer, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			mineLayer.pos.dist(playerObj.pos) < mineLayer.hb + 8
		) {
			applyDamage(playerObj, profile.damage, {
				source: { name: "MINE LAYER", sprite: "enemy_mine_layer" },
			})
			applyDamage(mineLayer, mineLayer.hp)
		}
	})

	mineLayer.onDeath(() => {
		enemyOnDeath(mineLayer.pos, 6 * profile.rewardMultiplier, 1.3 * profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(mineLayer)
	})
	mineLayer.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		mineLayer.animation.seek(0)
	})

	return mineLayer
}

function spawnEnemyMine(pos: Vec2, damage: number, extraTags?: string[]) {
	let triggered = false
	const mine = k.add([
		k.pos(pos),
		k.sprite("room_proximity_mine"),
		k.anchor("center"),
		k.layer(layers.gameEffects),
		k.rotate(k.rand(360)),
		k.scale(0.72),
		k.color(255, 170, 55),
		k.opacity(0.9),
		{
			armedElapsed: 0,
			triggerElapsed: 0,
			lifeSpan: 0,
		},
		tags.props,
		tags.gameLoop,
		...(extraTags ?? []),
	])

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
		mine.color = triggered ? k.rgb(255, 55, 55) : k.rgb(255, 170, 55)
		mine.opacity = triggered
			? k.wave(0.3, 1, k.time() * 14)
			: k.wave(0.6, 1, k.time() * 4)

		if (!triggered && mine.pos.dist(playerObj.pos) < 34) triggered = true
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
	const explosionPos = mine.pos.clone()
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
	spawnExplosionEffect(explosionPos, 52)
	audioService.playPositionalSound("explosion2", explosionPos, {
		volume: mainSoundVolume * 0.8,
		maxDistance: 650,
	})
	k.destroy(mine)
}
