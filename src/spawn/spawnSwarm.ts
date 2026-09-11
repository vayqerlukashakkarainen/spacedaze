import type { GameObj, Vec2 } from "kaplay"
import { timescale } from "../comp/timescale"
import { snareable } from "../comp/snareable"
import { getShipThrusterFlash } from "../comp/shipThruster"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, layers, mainSoundVolume, velocityScale } from "../main"
import { gameSoundService } from "../services/audio/gameSoundService"
import { applyDamage } from "../services/combat/damageService"
import { createCadencedSystem } from "../services/core/cadencedSystemService"
import { createContinuousSystem } from "../services/core/continuousSystemService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
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
import { enemyOnDeath, onEnemyHit } from "./enemyShared"
import { DensePool } from "../services/core/densePool"
import { spawnEnemyDeathEffect } from "./spawnEnemyDeathEffect"
import { setHitSoundProfile } from "../services/audio/hitSoundService"
import { spawnEnemyDeathWreckage } from "../services/combat/persistentShipPartService"

type SwarmPhase = "gather" | "stage" | "charge" | "regroup"

interface SwarmCommand {
	target: Vec2
	speed: number
	charging: boolean
}

export interface SwarmPatrol {
	center: Vec2
	radiusX: number
	radiusY: number
	angularSpeed: number
	phase: number
	speed: number
}

export interface SwarmEnemyBehavior {
	patrol?: SwarmPatrol
	suppressRewards?: boolean
	onDeath?: () => void
}

const MINIMUM_COORDINATED_SWARM = 5
const RECRUIT_RADIUS = 640
const STAGING_DISTANCE = 185
const SWARM_DRONE_VISUAL = getEnemyVisual("swarm-drone")
const SWARM_HIVEMIND_VISUAL = getEnemyVisual("hivemind")
const SWARM_TURN_RESPONSE = 4.5
const SWARM_CHARGE_TURN_RESPONSE = 9
const HIVEMIND_TURN_RESPONSE = 3.5
const SWARM_THRUSTER_REFERENCE_SPEED = 130
const CROWDED_SWARM_THRESHOLD = 250
let swarmOutlineOffsets: Vec2[] | undefined

interface SwarmDecisionEntry {
	owner: GameObj
	speedMultiplier: number
}

const swarmDecisionSystem = createCadencedSystem<SwarmDecisionEntry>({
	id: "swarm-decisions",
	rate: 20,
	updateBucket(entries) {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index]
			if (!entry) continue
			if (!entry.owner.exists() || entry.owner.paused) continue
			updateSwarmDecision(entry.owner, entry.speedMultiplier)
		}
	},
})

interface SwarmContinuousEntry {
	owner: GameObj
	visual: SwarmVisualEntry
}

interface SwarmCollisionEntry {
	owner: GameObj
}

interface SwarmVisualEntry {
	owner: GameObj
	thrusterLength: number
}

const swarmVisuals = new DensePool<SwarmVisualEntry>((entry) => entry.owner.id)
let swarmVisualController: GameObj | undefined
let crowdedCollisionCycle = 0

const swarmContinuousSystem = createContinuousSystem<SwarmContinuousEntry>({
	id: "swarm",
	updateBatch(entries) {
		const flashVisible = getShipThrusterFlash(k.time())
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index]
			if (!entry) continue
			const enemy = entry.owner
			if (!enemy.exists() || enemy.paused) continue
			const command = enemy.swarmCommand as SwarmCommand | undefined
			if (enemy.desiredDirection) {
				const navigationDirection = enemy.navigationDirection ??
					enemy.desiredDirection
				const turnResponse = command?.charging
					? SWARM_CHARGE_TURN_RESPONSE
					: SWARM_TURN_RESPONSE
				enemy.moveDirection = easeDirection(
					enemy.moveDirection,
					navigationDirection,
					turnResponse,
					k.dt() * enemy.getTimescale()
				)
				enemy.move(
					enemy.moveDirection.scale(
						enemy.desiredSpeed * velocityScale() * enemy.getTimescale()
					)
				)
				enemy.angle = enemy.moveDirection.angle() + 90
				applyDirectionalSteeringLean(
					enemy,
					enemy.moveDirection,
					navigationDirection,
					enemy.baseScale
				)
			}

			const speed = enemy.desiredDirection
				? enemy.desiredSpeed * enemy.getTimescale()
				: 0
			const speedRatio = k.clamp(speed / SWARM_THRUSTER_REFERENCE_SPEED, 0, 3)
			entry.visual.thrusterLength = speed > 4 && flashVisible
				? Math.round(k.clamp(2 + 5 * speedRatio, 2, 18))
				: 0
		}
	},
})

const swarmCollisionSystem = createCadencedSystem<SwarmCollisionEntry>({
	id: "swarm-collisions",
	rate: 30,
	updateBucket(entries) {
		const crowded = swarmVisuals.size >= CROWDED_SWARM_THRESHOLD
		const crowdedPhase = Math.floor(crowdedCollisionCycle++ / 2) % 2
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index]
			if (!entry) continue
			const enemy = entry.owner
			if (!enemy.exists() || enemy.paused) continue
			if (crowded && Math.floor(enemy.id / 2) % 2 !== crowdedPhase) continue
			checkProjectileIntersection(
				enemy.pos,
				enemy.hb + 6,
				tags.friendly,
				(projectile) => {
					if (projectile.is(tags.stressProjectile)) return
					onEnemyHit(enemy, projectile)
				}
			)
			if (
				!enemy.is(tags.stressEnemy) &&
				!isEnemyEmpDisrupted(enemy) &&
				!isPlayerDamageInvulnerable() &&
				enemy.pos.dist(playerObj.pos) < enemy.hb + 8
			) {
				applyDamage(playerObj, enemy.damage, {
					position: enemy.pos,
					source: { name: "SWARM DRONE", sprite: "enemy_swarm_drone" },
				})
				applyDamage(enemy, enemy.hp)
			}
		}
	},
})

/**
 * The most basic mobile enemy. Without a living hivemind it has no tactics: it
 * simply turns toward the player and slowly tries to make contact.
 */
export function spawnSwarmEnemy(
	pos: Vec2,
	hp = 2,
	options: EnemySpawnOptions = {},
	hiveMind?: GameObj,
	behavior: SwarmEnemyBehavior = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		SWARM_DRONE_VISUAL.worldScale,
		options
	)
	const spriteScale = profile.scale
	const initialTarget = playerObj.pos.sub(pos)
	const initialDirection = initialTarget.len() > 0
		? initialTarget.unit()
		: k.vec2(0, -1)
	const enemy = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(SWARM_DRONE_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(spriteScale),
		timescale(),
		snareable({
			mass: 0.35,
			radius: 9 * spriteScale,
			releaseDrag: 1.2,
			suspendTimescaleWhileMoving: true,
			canSnare: () => !profile.elite,
		}),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			draw() {
				k.drawRect({
					pos: k.vec2(0, -3 / spriteScale),
					width: 2 / spriteScale,
					height: 2 / spriteScale,
					anchor: "center",
					color: k.WHITE,
				})
			},
		},
		{
			hb: 9 * spriteScale,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.swarmDrone,
			moveDirection: initialDirection,
			desiredDirection: initialDirection,
			navigationDirection: initialDirection,
			desiredSpeed: 48 * profile.speedMultiplier,
			baseScale: spriteScale,
			hiveMind,
			patrol: behavior.patrol,
			swarmCommand: undefined as SwarmCommand | undefined,
		},
		tags.enemy,
		tags.unit,
		tags.swarmEnemy,
		tags.enemyRolePressure,
		tags.enemyRoleSwarm,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(enemy, "lightMetal")
	const visual = registerSwarmVisual(enemy)

	registerHitAnimation(enemy)
	swarmDecisionSystem.add({ owner: enemy, speedMultiplier: profile.speedMultiplier })
	swarmContinuousSystem.add({
		owner: enemy,
		visual,
	})
	swarmCollisionSystem.add({ owner: enemy })

	enemy.onDeath(() => {
		if (behavior.suppressRewards) {
			spawnEnemyDeathEffect(enemy.pos, 0.42, "normal", {
				particleScale: 0.35,
			})
			spawnEnemyDeathWreckage(enemy.pos, {
				count: 1,
				scale: 0.6,
				force: 48,
			})
			gameSoundService.playPositional("enemy_ship_destroyed", enemy.pos, {
				volume: mainSoundVolume * 0.45,
			})
		} else enemyOnDeath(
			enemy.pos,
			2 * profile.rewardMultiplier,
			profile.rewardMultiplier,
			"enemy",
			true,
			{
				intensity: 0.42,
				starCount: 5,
				tier: profile.elite ? "elite" : "normal",
				particleScale: 0.35,
				material: "ship",
			},
			enemy
		)
		k.destroy(enemy)
		behavior.onDeath?.()
	})
	enemy.onHurt(() => {
		enemy.animation.seek(0)
	})

	return enemy
}

function registerSwarmVisual(enemy: GameObj) {
	ensureSwarmVisualController()
	const visual: SwarmVisualEntry = {
		owner: enemy,
		thrusterLength: 0,
	}
	swarmVisuals.add(visual)
	enemy.dataOrientedVisual = true
	enemy.hidden = true
	enemy.onDestroy(() => swarmVisuals.remove(enemy.id))
	return visual
}

function ensureSwarmVisualController() {
	if (swarmVisualController?.exists()) return
	const controller = k.add([
		k.pos(0, 0),
		k.layer(layers.game),
		{
			draw() {
				const camera = k.getCamPos()
				const cameraScale = k.getCamScale()
				const horizontalPadding = 32 / cameraScale.x
				const verticalPadding = 32 / cameraScale.y
				const halfWidth = k.width() / (2 * cameraScale.x) + horizontalPadding
				const halfHeight = k.height() / (2 * cameraScale.y) + verticalPadding
				const minX = camera.x - halfWidth
				const maxX = camera.x + halfWidth
				const minY = camera.y - halfHeight
				const maxY = camera.y + halfHeight
				swarmVisuals.withItems((visuals) => {
					for (let index = 0; index < visuals.length; index++) {
						drawSwarmVisual(visuals[index], minX, maxX, minY, maxY)
					}
				})
			},
		},
	])
	swarmVisualController = controller
	controller.onDestroy(() => {
		if (swarmVisualController?.id === controller.id) {
			swarmVisualController = undefined
		}
		swarmVisuals.clear()
	})
}

function drawSwarmVisual(
	visual: SwarmVisualEntry,
	minX: number,
	maxX: number,
	minY: number,
	maxY: number
) {
	const enemy = visual.owner
	if (!enemy.exists()) return
	if (
		enemy.pos.x < minX ||
		enemy.pos.x > maxX ||
		enemy.pos.y < minY ||
		enemy.pos.y > maxY
	) return
	const visualHitOffset = enemy.visualHitOffset as Vec2 | undefined
	k.pushTransform()
	k.pushTranslate(
		visualHitOffset
			? enemy.pos.add(visualHitOffset)
			: enemy.pos
	)
	k.pushRotate(enemy.angle)
	k.pushScale(enemy.scale)
	const opacity = enemy.opacity ?? 1
	for (const offset of getSwarmOutlineOffsets()) {
		k.drawSprite({
			sprite: "enemy_swarm_drone",
			pos: offset,
			anchor: "center",
			color: k.BLACK,
			opacity,
		})
	}
	k.drawSprite({
		sprite: "enemy_swarm_drone",
		anchor: "center",
		color: enemy.color,
		opacity,
	})
	k.drawRect({
		pos: k.vec2(0, -3 / enemy.scale.y),
		width: 2 / enemy.scale.x,
		height: 2 / enemy.scale.y,
		anchor: "center",
		color: k.WHITE,
		opacity: enemy.opacity ?? 1,
	})
	if (visual.thrusterLength > 0) {
		drawSwarmThruster(enemy.height / 2 - 2, visual.thrusterLength)
	}
	k.popTransform()
}

function getSwarmOutlineOffsets() {
	if (swarmOutlineOffsets) return swarmOutlineOffsets
	swarmOutlineOffsets = [
		k.vec2(-1, -1),
		k.vec2(0, -1),
		k.vec2(1, -1),
		k.vec2(-1, 0),
		k.vec2(1, 0),
		k.vec2(-1, 1),
		k.vec2(0, 1),
		k.vec2(1, 1),
	]
	return swarmOutlineOffsets
}

function drawSwarmThruster(nozzleY: number, length: number) {
	k.drawRect({
		pos: k.vec2(-1, nozzleY),
		width: 2,
		height: length,
		color: k.WHITE,
	})
}

function updateSwarmDecision(enemy: GameObj, speedMultiplier: number) {
	const patrol = enemy.patrol as SwarmPatrol | undefined
	if (patrol) {
		const angle = patrol.phase + k.time() * patrol.angularSpeed
		const lookAhead = angle + Math.sign(patrol.angularSpeed) * 24
		const target = patrol.center.add(
			Math.cos(lookAhead * Math.PI / 180) * patrol.radiusX,
			Math.sin(lookAhead * Math.PI / 180) * patrol.radiusY
		)
		const toTarget = target.sub(enemy.pos)
		enemy.hiveMind = undefined
		enemy.swarmCommand = undefined
		enemy.desiredDirection = toTarget.len() > 1 ? toTarget.unit() : k.vec2(0)
		enemy.navigationDirection = enemy.desiredDirection
		enemy.desiredSpeed = patrol.speed
		return
	}
	const hive = enemy.hiveMind as GameObj | undefined
	const hasHive = hive?.exists() && hive.tags.includes(tags.hiveMind)
	if (!hasHive) {
		enemy.hiveMind = undefined
		enemy.swarmCommand = undefined
	}

	const command = enemy.swarmCommand as SwarmCommand | undefined
	const target = hasHive && command ? command.target : playerObj.pos
	const toTarget = target.sub(enemy.pos)
	if (toTarget.len() <= 1) {
		enemy.desiredDirection = k.vec2(0)
		enemy.navigationDirection = k.vec2(0)
		return
	}
	enemy.desiredDirection = toTarget.unit()
	enemy.navigationDirection = getEnemyNavigationDirection(
		enemy,
		enemy.desiredDirection,
		target
	)
	enemy.desiredSpeed = hasHive && command
		? command.speed
		: 48 * speedMultiplier
}

/**
 * A killable controller which recruits nearby swarm enemies and is solely
 * responsible for their formation and mass-charge commands.
 */
export function spawnHiveMind(
	pos: Vec2,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		9,
		1,
		SWARM_HIVEMIND_VISUAL.worldScale,
		options
	)
	const spriteScale = profile.scale
	const hive = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(SWARM_HIVEMIND_VISUAL)),
		k.color(k.WHITE),
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
			threatRank: ENEMY_THREAT_RANK.hiveMind,
			moveDirection: k.vec2(0, -1),
			baseScale: spriteScale,
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
		tags.enemyRoleSupport,
		tags.enemyRoleSwarm,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(hive, "heavyMetal")
	hive.add([
		k.circle(3 / spriteScale),
		k.anchor("center"),
		k.color(k.WHITE),
	])
	const innerPulse = hive.add([
		k.circle(14 / spriteScale, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.WHITE),
		k.opacity(0.8),
		k.z(-1),
	])
	const outerPulse = hive.add([
		k.circle(22 / spriteScale, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.WHITE),
		k.opacity(0.35),
		k.scale(1),
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
			!isEnemyEmpDisrupted(hive) &&
			!isPlayerDamageInvulnerable() &&
			hive.pos.dist(playerObj.pos) < hive.hb + 8
		) {
			applyDamage(playerObj, hive.damage, {
				position: hive.pos,
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
		enemyOnDeath(
			hive.pos,
			10 * profile.rewardMultiplier,
			1.6 * profile.rewardMultiplier,
			"enemy",
			true,
			{
				tier: profile.elite ? "elite" : "normal",
				material: "ship",
			},
			hive
		)
		k.destroy(hive)
	})
	hive.onDestroy(releaseSwarm)
	hive.onHurt(() => {
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
		if (candidate.patrol) continue
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
		gameSoundService.play("shoot1", { volume: mainSoundVolume * 0.7 })
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
	let desiredDirection = direction
	if (toTarget.len() > 4) {
		desiredDirection = getEnemyNavigationDirection(
			hive,
			toTarget.unit(),
			target
		)
		hive.moveDirection = easeDirection(
			hive.moveDirection,
			desiredDirection,
			HIVEMIND_TURN_RESPONSE,
			k.dt() * hive.getTimescale()
		)
		hive.move(
			hive.moveDirection.scale(
				54 * speedMultiplier * velocityScale() * hive.getTimescale()
			)
		)
		hive.angle = hive.moveDirection.angle() + 90
	} else {
		hive.moveDirection = easeDirection(
			hive.moveDirection,
			direction,
			HIVEMIND_TURN_RESPONSE,
			k.dt() * hive.getTimescale()
		)
		hive.angle = hive.moveDirection.angle() + 90
	}
	applyDirectionalSteeringLean(
		hive,
		hive.moveDirection,
		desiredDirection,
		hive.baseScale,
		true
	)
}

function centeredIndex(index: number) {
	if (index === 0) return 0
	const magnitude = Math.ceil(index / 2)
	return index % 2 === 1 ? -magnitude : magnitude
}
