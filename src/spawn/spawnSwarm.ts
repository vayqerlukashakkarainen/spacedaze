import type { GameObj, Vec2 } from "kaplay"
import { timescale } from "../comp/timescale"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main"
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
import { enemyOnDeath, onEnemyHit } from "./enemyShared"

type SwarmPhase = "gather" | "stage" | "charge" | "regroup"

interface SwarmCommand {
	target: Vec2
	speed: number
	charging: boolean
}

const MINIMUM_COORDINATED_SWARM = 5
const RECRUIT_RADIUS = 640
const STAGING_DISTANCE = 185

/**
 * The most basic mobile enemy. Without a living hivemind it has no tactics: it
 * simply turns toward the player and slowly tries to make contact.
 */
export function spawnSwarmEnemy(
	pos: Vec2,
	hp = 2,
	options: EnemySpawnOptions = {},
	hiveMind?: GameObj
) {
	const profile = createEnemySpawnProfile(hp, 1, 1, options)
	const spriteScale = profile.elite ? 2 : 1
	const enemy = k.add([
		k.pos(pos),
		k.sprite("enemy_swarm_drone"),
		k.color(...profile.tint),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(spriteScale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 9 * spriteScale,
			damage: profile.damage,
			hiveMind,
			swarmCommand: undefined as SwarmCommand | undefined,
		},
		tags.enemy,
		tags.unit,
		tags.swarmEnemy,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	enemy.add([
		k.rect(2 / spriteScale, 2 / spriteScale),
		k.pos(0, -3 / spriteScale),
		k.anchor("center"),
		k.color(205, 55, 55),
	])

	registerHitAnimation(enemy)
	registerBatchedEntityUpdate("enemies", enemy, () => {
		const hive = enemy.hiveMind as GameObj | undefined
		const hasHive = hive?.exists() && hive.tags.includes(tags.hiveMind)
		if (!hasHive) {
			enemy.hiveMind = undefined
			enemy.swarmCommand = undefined
		}

		const command = enemy.swarmCommand as SwarmCommand | undefined
		const target = hasHive && command
			? command.target
			: playerObj.pos
		const toTarget = target.sub(enemy.pos)
		const distance = toTarget.len()
		if (distance > 1) {
			const direction = toTarget.unit()
			const speed = hasHive && command
				? command.speed
				: 48 * profile.speedMultiplier
			enemy.move(
				direction.scale(speed * velocityScale() * enemy.getTimescale())
			)
			enemy.angle = direction.angle() + 90
		}

		checkProjectileIntersection(enemy.pos, enemy.hb, tags.friendly, (projectile) => {
			onEnemyHit(enemy, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			enemy.pos.dist(playerObj.pos) < enemy.hb + 8
		) {
			applyDamage(playerObj, enemy.damage, {
				source: { name: "SWARM DRONE", sprite: "enemy_swarm_drone" },
			})
			applyDamage(enemy, enemy.hp)
		}
	})

	enemy.onDeath(() => {
		enemyOnDeath(enemy.pos, 2 * profile.rewardMultiplier, profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume * 0.7 })
		k.destroy(enemy)
	})
	enemy.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume * 0.75 })
		enemy.animation.seek(0)
	})

	return enemy
}

/**
 * A killable controller which recruits nearby swarm enemies and is solely
 * responsible for their formation and mass-charge commands.
 */
export function spawnHiveMind(
	pos: Vec2,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(9, 1, 1, options)
	const spriteScale = profile.elite ? 2 : 1
	const hive = k.add([
		k.pos(pos),
		k.sprite("enemy_swarm_hivemind"),
		k.color(...profile.tint),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(spriteScale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 22 * spriteScale,
			damage: profile.damage,
			members: [] as GameObj[],
			phase: "gather" as SwarmPhase,
			phaseTimer: 0,
			recruitTimer: 0,
			chargeDirection: k.vec2(0, 1),
			chargeTargets: [] as Vec2[],
		},
		tags.enemy,
		tags.unit,
		tags.hiveMind,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	hive.add([
		k.circle(3 / spriteScale),
		k.anchor("center"),
		k.color(170, 70, 205),
	])
	const innerPulse = hive.add([
		k.circle(14 / spriteScale, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(215, 95, 235)),
		k.opacity(0.8),
		k.z(-1),
	])
	const outerPulse = hive.add([
		k.circle(22 / spriteScale, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(145, 55, 180)),
		k.opacity(0.35),
		k.z(-1),
	])

	registerHitAnimation(hive)
	registerBatchedEntityUpdate("enemies", hive, () => {
		const delta = k.dt() * hive.getTimescale()
		hive.phaseTimer += delta
		hive.recruitTimer -= delta
		if (hive.recruitTimer <= 0) {
			recruitNearbySwarm(hive)
			hive.recruitTimer = 0.75
		}
		hive.members = hive.members.filter((member: GameObj) => member.exists())

		updateHivePhase(hive)
		commandSwarm(hive, profile.speedMultiplier)
		moveHiveMind(hive, profile.speedMultiplier)

		innerPulse.opacity = k.wave(0.45, 0.9, k.time() * 5)
		outerPulse.opacity = hive.phase === "charge"
			? k.wave(0.45, 1, k.time() * 11)
			: k.wave(0.18, 0.5, k.time() * 3)
		outerPulse.scale = k.vec2(k.wave(0.92, 1.12, k.time() * 3))

		checkProjectileIntersection(hive.pos, hive.hb, tags.friendly, (projectile) => {
			onEnemyHit(hive, projectile)
		})
		if (
			!isPlayerDamageInvulnerable() &&
			hive.pos.dist(playerObj.pos) < hive.hb + 8
		) {
			applyDamage(playerObj, hive.damage, {
				source: { name: "SWARM HIVEMIND", sprite: "enemy_swarm_hivemind" },
			})
			applyDamage(hive, hive.hp)
		}
	})

	const releaseSwarm = () => {
		for (const member of hive.members as GameObj[]) {
			if (!member.exists() || member.hiveMind?.id !== hive.id) continue
			member.hiveMind = undefined
			member.swarmCommand = undefined
		}
		hive.members = []
	}
	hive.onDeath(() => {
		releaseSwarm()
		enemyOnDeath(hive.pos, 10 * profile.rewardMultiplier, 1.6 * profile.rewardMultiplier)
		audioService.playSound(randomExplosion(), { volume: subSoundVolume })
		k.destroy(hive)
	})
	hive.onDestroy(releaseSwarm)
	hive.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume })
		hive.animation.seek(0)
		innerPulse.opacity = 1
	})

	return hive
}

export function spawnSwarmGroup(
	center: Vec2,
	count: number,
	options: EnemySpawnOptions = {}
) {
	const hive = spawnHiveMind(center, options)
	const memberCount = Math.max(1, Math.floor(count))
	for (let index = 0; index < memberCount; index++) {
		const angle = -90 + 360 / memberCount * index
		const memberPos = center.add(k.Vec2.fromAngle(angle).scale(54))
		const member = spawnSwarmEnemy(memberPos, 2, options, hive)
		hive.members.push(member)
	}
	return hive
}

function recruitNearbySwarm(hive: GameObj) {
	for (const candidate of k.get(tags.swarmEnemy)) {
		if (!candidate.exists() || candidate.pos.dist(hive.pos) > RECRUIT_RADIUS) continue
		const currentHive = candidate.hiveMind as GameObj | undefined
		if (currentHive?.exists() && currentHive.id !== hive.id) continue
		candidate.hiveMind = hive
		if (!(hive.members as GameObj[]).some((member) => member.id === candidate.id)) {
			hive.members.push(candidate)
		}
	}
}

function updateHivePhase(hive: GameObj) {
	const isLargeEnough = hive.members.length >= MINIMUM_COORDINATED_SWARM
	if (!isLargeEnough) {
		hive.phase = "gather"
		hive.phaseTimer = 0
		return
	}

	if (hive.phase === "gather" && hive.phaseTimer >= 1.6) {
		hive.phase = "stage"
		hive.phaseTimer = 0
		return
	}
	if (hive.phase === "stage" && hive.phaseTimer >= 1) {
		hive.phase = "charge"
		hive.phaseTimer = 0
		const toPlayer = playerObj.pos.sub(hive.pos)
		hive.chargeDirection = toPlayer.len() > 0 ? toPlayer.unit() : k.vec2(0, 1)
		hive.chargeTargets = hive.members.map((_member: GameObj, index: number) => {
			const lane = centeredIndex(index) * 19
			const perpendicular = k.vec2(-hive.chargeDirection.y, hive.chargeDirection.x)
			return playerObj.pos
				.add(hive.chargeDirection.scale(165))
				.add(perpendicular.scale(lane))
		})
		audioService.playSound("shoot1", { volume: mainSoundVolume * 0.7 })
		return
	}
	if (hive.phase === "charge" && hive.phaseTimer >= 1.35) {
		hive.phase = "regroup"
		hive.phaseTimer = 0
		return
	}
	if (hive.phase === "regroup" && hive.phaseTimer >= 1.4) {
		hive.phase = "stage"
		hive.phaseTimer = 0
	}
}

function commandSwarm(hive: GameObj, speedMultiplier: number) {
	const toPlayer = playerObj.pos.sub(hive.pos)
	const towardPlayer = toPlayer.len() > 0 ? toPlayer.unit() : k.vec2(0, 1)
	const perpendicular = k.vec2(-towardPlayer.y, towardPlayer.x)
	const stageCenter = playerObj.pos.sub(towardPlayer.scale(STAGING_DISTANCE))

	for (let index = 0; index < hive.members.length; index++) {
		const member = hive.members[index] as GameObj
		if (!member.exists()) continue
		const lane = centeredIndex(index)
		let target: Vec2
		let speed: number

		if (hive.phase === "charge") {
			target = hive.chargeTargets[index]
				?? playerObj.pos.add(hive.chargeDirection.scale(165))
			speed = 235
		} else if (hive.phase === "regroup") {
			const angle = -90 + 360 / Math.max(1, hive.members.length) * index
			target = hive.pos.add(k.Vec2.fromAngle(angle).scale(58))
			speed = 100
		} else {
			const depth = Math.abs(lane) * 9
			target = stageCenter
				.add(perpendicular.scale(lane * 27))
				.sub(towardPlayer.scale(depth))
			speed = hive.phase === "stage" ? 78 : 92
		}

		member.swarmCommand = {
			target,
			speed: speed * speedMultiplier,
			charging: hive.phase === "charge",
		} as SwarmCommand
	}
}

function moveHiveMind(hive: GameObj, speedMultiplier: number) {
	const toPlayer = playerObj.pos.sub(hive.pos)
	const direction = toPlayer.len() > 0 ? toPlayer.unit() : k.vec2(0, 1)
	const targetDistance = hive.phase === "charge" ? 245 : 225
	const target = playerObj.pos.sub(direction.scale(targetDistance))
	const toTarget = target.sub(hive.pos)
	if (toTarget.len() > 4) {
		const movement = toTarget.unit()
		hive.move(
			movement.scale(54 * speedMultiplier * velocityScale() * hive.getTimescale())
		)
		hive.angle = movement.angle() + 90
	} else {
		hive.angle = direction.angle() + 90
	}
}

function centeredIndex(index: number) {
	if (index === 0) return 0
	const magnitude = Math.ceil(index / 2)
	return index % 2 === 1 ? -magnitude : magnitude
}
