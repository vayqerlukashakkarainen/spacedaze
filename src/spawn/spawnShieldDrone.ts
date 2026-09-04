import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, layers, mainSoundVolume, subSoundVolume } from "../main"
import { audioService } from "../services/audioService"
import { applyDamage } from "../services/damageService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { isPlayerDamageInvulnerable } from "../services/playerDamageState"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService"
import { registerHitAnimation } from "../shared"
import { tags } from "../tags"
import { randomExplosion } from "../util"
import { timescale } from "../comp/timescale"
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

const SHIELD_HOST_ACTION_SPEED_MULTIPLIER = 1.3
const SHIELD_HOST_DAMAGE_MULTIPLIER = 1.4
const SHIELD_RETARGET_INTERVAL = 6
const SHIELD_RETARGET_RADIUS = 280

export function spawnShieldDrone(
	pos: Vec2,
	initialTarget: GameObj,
	options: EnemySpawnOptions = {}
) {
	if (!initialTarget.exists()) return
	let protectedTarget = initialTarget
	let targetDestroyController: ReturnType<GameObj["onDestroy"]> | undefined
	let retargetTimer = SHIELD_RETARGET_INTERVAL
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
		tags.enemyRoleSupport,
		tags.shieldDrone,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const shieldLink = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(-1),
		{
			draw() {
				if (!drone.exists() || !protectedTarget.exists()) return
				const delta = protectedTarget.pos.sub(drone.pos)
				if (delta.len() <= 0) return
				const perpendicular = k.vec2(-delta.y, delta.x).unit()
				const points = Array.from({ length: 11 }, (_, index) => {
					const progress = index / 10
					const envelope = Math.sin(progress * Math.PI)
					const primaryWave = Math.sin(
						progress * Math.PI * 4 + k.time() * 9
					) * 3.4
					const secondaryWave = Math.sin(
						progress * Math.PI * 7 - k.time() * 5.5
					) * 1.4
					return drone.pos
						.add(delta.scale(progress))
						.add(perpendicular.scale((primaryWave + secondaryWave) * envelope))
				})
				k.drawLines({
					pts: points,
					width: 4,
					color: k.rgb(255, 65, 65),
					opacity: 0.2,
				})
				k.drawLines({
					pts: points,
					width: 1,
					color: k.rgb(255, 205, 205),
					opacity: k.wave(0.55, 0.95, k.time() * 8),
				})
			},
		},
		tags.gameLoop,
		...(options.tags ?? []),
	])
	attachToTarget(initialTarget)
	drone.onDestroy(() => {
		targetDestroyController?.cancel()
		if (shieldLink.exists()) k.destroy(shieldLink)
	})
	registerHitAnimation(drone)
	registerBatchedEntityUpdate("enemies", drone, () => {
		if (!protectedTarget.exists()) {
			if (!retargetShield(true)) k.destroy(drone)
			return
		}
		const delta = k.dt() * drone.getTimescale()
		retargetTimer -= delta
		if (retargetTimer <= 0) {
			retargetTimer = SHIELD_RETARGET_INTERVAL
			retargetShield(false)
		}
		drone.orbitAngle += delta * 75
		const followBlend = 1 - Math.exp(-9 * delta)
		drone.orbitCenter = drone.orbitCenter.lerp(
			protectedTarget.pos,
			followBlend
		)
		const orbitOffset = k.Vec2.fromAngle(drone.orbitAngle).scale(36)
		drone.pos = drone.orbitCenter.add(orbitOffset)
		drone.angle = orbitOffset.angle() + 90
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
	})

	function attachToTarget(target: GameObj) {
		if (
			!target.exists() ||
			(target === protectedTarget && target.shieldProvider === drone)
		) {
			return
		}
		targetDestroyController?.cancel()
		if (protectedTarget.exists()) clearShieldProvider(protectedTarget, drone)
		protectedTarget = target
		setShieldProvider(protectedTarget, drone)
		targetDestroyController = protectedTarget.onDestroy(() => {
			if (!drone.exists()) return
			if (!retargetShield(true)) k.destroy(drone)
		})
	}

	function retargetShield(required: boolean) {
		const currentThreat = protectedTarget.exists()
			? getShieldHostThreat(protectedTarget, drone)
			: -Infinity
		const candidates = (k.get(tags.enemy) as GameObj[])
			.filter((candidate) =>
				candidate !== drone &&
				candidate !== protectedTarget &&
				candidate.exists() &&
				candidate.is(tags.unit) &&
				!candidate.is(tags.shieldDrone) &&
				!candidate.shieldProvider &&
				candidate.pos.dist(drone.pos) <= SHIELD_RETARGET_RADIUS
			)
			.sort(
				(a, b) =>
					getShieldHostThreat(b) - getShieldHostThreat(a) ||
					a.pos.dist(playerObj.pos) - b.pos.dist(playerObj.pos)
			)
		const nextTarget = candidates[0]
		if (!nextTarget) return !required && protectedTarget.exists()
		if (!required && getShieldHostThreat(nextTarget) <= currentThreat) return true
		attachToTarget(nextTarget)
		return true
	}

	return drone
}

function getShieldHostThreat(target: GameObj, provider?: GameObj) {
	const maxHealth = typeof target.maxHP === "function" ? target.maxHP() : 1
	const baseDamage = provider?.shieldHostBaseDamage ?? target.damage ?? 0
	const archetypeRank = target.threatRank ?? ENEMY_THREAT_RANK.fighter
	const elitePriority = target.is(tags.elite) ? 100000 : 0
	return archetypeRank * 1000000 + elitePriority + maxHealth * 100 + baseDamage * 10
}

function setShieldProvider(target: GameObj, provider: GameObj) {
	target.shieldProvider = provider
	if (target.timescaleModifiers instanceof Map && provider.id !== undefined) {
		target.timescaleModifiers.set(
			provider.id,
			SHIELD_HOST_ACTION_SPEED_MULTIPLIER
		)
	}
	if (typeof target.damage === "number") {
		provider.shieldHostBaseDamage = target.damage
		target.damage *= SHIELD_HOST_DAMAGE_MULTIPLIER
	}
	provider.shieldHostBaseFireRateMultiplier = target.shieldFireRateMultiplier
	target.shieldFireRateMultiplier =
		(target.shieldFireRateMultiplier ?? 1) * SHIELD_HOST_ACTION_SPEED_MULTIPLIER
	const tintedObjects = [target, ...(target.children ?? [])].filter(
		(object) => object.color !== undefined
	)
	provider.shieldHostBaseColors = tintedObjects.map((object) => ({
		object,
		color: k.rgb(object.color.r, object.color.g, object.color.b),
	}))
	for (const { object, color } of provider.shieldHostBaseColors) {
		object.color = k.rgb(color.r, color.g * 0.76, color.b * 0.76)
	}
	for (const child of target.children ?? []) {
		if (typeof child.hp === "number") child.shieldProvider = provider
	}
}

function clearShieldProvider(target: GameObj, provider: GameObj) {
	if (target.shieldProvider === provider) {
		target.shieldProvider = undefined
		if (target.timescaleModifiers instanceof Map && provider.id !== undefined) {
			target.timescaleModifiers.delete(provider.id)
		}
		if (typeof provider.shieldHostBaseDamage === "number") {
			target.damage = provider.shieldHostBaseDamage
		}
		target.shieldFireRateMultiplier = provider.shieldHostBaseFireRateMultiplier
	}
	for (const entry of provider.shieldHostBaseColors ?? []) {
		if (!entry.object.exists()) continue
		entry.object.color = entry.color
	}
	provider.shieldHostBaseColors = undefined
	for (const child of target.children ?? []) {
		if (child.shieldProvider === provider) child.shieldProvider = undefined
	}
}
