import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume } from "../main"
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

export function spawnShieldDrone(
	pos: Vec2,
	protectedTarget: GameObj,
	options: EnemySpawnOptions = {}
) {
	if (!protectedTarget.exists()) return
	const profile = createEnemySpawnProfile(4, 1, 0.72, options)
	const drone = k.add([
		k.pos(pos),
		k.sprite("enemy_shield_drone"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		{
			hb: 11 * profile.scale,
			damage: profile.damage,
			orbitAngle: k.rand(360),
			orbitCenter: protectedTarget.pos.clone(),
		},
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const shieldRing = drone.add([
		k.circle(34 / profile.scale, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.WHITE),
		k.opacity(0.55),
		k.z(-1),
	])

	setShieldProvider(protectedTarget, drone)
	protectedTarget.onDestroy(() => {
		if (drone.exists()) k.destroy(drone)
	})
	registerHitAnimation(drone)
	registerBatchedEntityUpdate("enemies", drone, () => {
		if (!protectedTarget.exists()) {
			k.destroy(drone)
			return
		}
		const delta = k.dt() * drone.getTimescale()
		drone.orbitAngle += delta * 75
		const followBlend = 1 - Math.exp(-9 * delta)
		drone.orbitCenter = drone.orbitCenter.lerp(
			protectedTarget.pos,
			followBlend
		)
		const orbitOffset = k.Vec2.fromAngle(drone.orbitAngle).scale(36)
		drone.pos = drone.orbitCenter.add(orbitOffset)
		drone.angle = orbitOffset.angle() + 90
		shieldRing.opacity = k.wave(0.3, 0.75, k.time() * 4)
		shieldRing.scale = k.vec2(k.wave(0.96, 1.05, k.time() * 3))

		checkProjectileIntersection(drone.pos, drone.hb, tags.friendly, (projectile) => {
			onEnemyHit(drone, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			drone.pos.dist(playerObj.pos) < drone.hb + 8
		) {
			applyDamage(playerObj, drone.damage, {
				source: { name: "SHIELD DRONE", sprite: "enemy_shield_drone" },
			})
			applyDamage(drone, drone.hp)
		}
	})

	drone.onDeath(() => {
		clearShieldProvider(protectedTarget, drone)
		enemyOnDeath(drone.pos, 5 * profile.rewardMultiplier, 1.2 * profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(drone)
	})
	drone.onDestroy(() => clearShieldProvider(protectedTarget, drone))
	drone.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		drone.animation.seek(0)
		shieldRing.opacity = 1
	})

	return drone
}

function setShieldProvider(target: GameObj, provider: GameObj) {
	target.shieldProvider = provider
	for (const child of target.children ?? []) {
		if (typeof child.hp === "number") child.shieldProvider = provider
	}
}

function clearShieldProvider(target: GameObj, provider: GameObj) {
	if (target.shieldProvider === provider) target.shieldProvider = undefined
	for (const child of target.children ?? []) {
		if (child.shieldProvider === provider) child.shieldProvider = undefined
	}
}
