import type { GameObj, PosComp, Vec2 } from "kaplay"
import type { SnareableComp } from "../../comp/snareable"
import { gridCollision } from "../../comp/gridCollision"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import { emitImpactChips } from "../../particles"
import { spawnFlash } from "../../spawn/spawnFlash"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common/theme"
import { applyEnemyProjectileImpact } from "../combat/combatImpactService"
import { applyDamage } from "../combat/damageService"
import type { InputController } from "../input/inputBindingService"
import { onInputActionPress } from "../input/inputBindingService"
import { gameSoundService } from "../audio/gameSoundService"
import { applyKnockbackImpulse } from "../combat/projectileService"
import {
	queryPersistentShipParts,
	transferPersistentShipPartToRoom,
	wakePersistentShipPart,
} from "../combat/persistentShipPartService"
import { querySpatialNearby } from "../core/runtimeSpatialIndexService"
import {
	getTargetHitRadius,
	getTargetWorldPosition,
} from "../combat/targetingService"

const POINTER_ACQUIRE_RADIUS = 56
const MAX_QUERY_TARGET_RADIUS = 48
const MAX_CAST_RANGE = 280
const BREAK_RANGE = 360
const ROPE_LENGTH = 62
const SPRING_STIFFNESS = 38
const SPRING_DAMPING = 8.5
const TETHER_DRAG = 0.32
const MAX_TARGET_SPEED = 620
const MAX_PLAYER_PULL_SPEED = 300
const TETHER_ANGULAR_RESPONSE = 7
const HOOK_SPEED = 950
const MIN_HOOK_DURATION = 0.08
const MAX_HOOK_DURATION = 0.24
const PHYSICS_STEP = 1 / 120
const MAX_FRAME_DELTA = 1 / 20
const MIN_SLAM_SPEED = 105
const MAX_SLAM_SPEED = 500
const SLAM_QUERY_TARGET_RADIUS = 72
const SLAM_CONTACT_COOLDOWN = 0.22
const SLAM_VELOCITY_RETENTION = 0.6
const SLAM_BASE_DAMAGE = 4
const SLAM_MAX_DAMAGE = 22
const THRUSTER_LOAD_BASE_MASS = 1
const THRUSTER_LOAD_FULL_MASS = 3.5
const THRUSTER_LOAD_FULL_FORCE = 630

type SnareTarget = GameObj<PosComp | SnareableComp>

interface PlayerLassoOptions {
	player: GameObj<PosComp>
	inputBlocked: () => boolean
	isUnlocked: () => boolean
	isStrafeModeActive: () => boolean
	getStrafeAimPosition: () => Vec2
}

interface CastState {
	target: SnareTarget
	elapsed: number
	duration: number
	hookPosition: Vec2
}

interface SlamState {
	target: SnareTarget
	activeContacts: Set<number>
	lastImpactAt: Map<number, number>
	lastRoomImpactAt: number
}

interface TetherState extends SlamState {
	tension: number
}

interface LaunchedState extends SlamState {
	lastPosition: Vec2
	elapsed: number
}

const LASSO_THROW_SPEED = 760
const LASSO_THROW_MAX_SPEED = 900
const LASSO_THROW_MOMENTUM_TRANSFER = 0.3
const LASSO_MOMENTUM_RELEASE_MULTIPLIER = 1.2
const LASSO_THROW_TRACK_DURATION = 4

interface ActivePlayerLassoRuntime {
	player: GameObj<PosComp>
	getTetheredTarget: () => SnareTarget | undefined
	getThrusterLoad: () => number
}

interface PlayerLassoRoomTransfer {
	target: SnareTarget
	offset: Vec2
	followPlayer: boolean
}

let activePlayerLassoRuntime: ActivePlayerLassoRuntime | undefined
let playerLassoRoomTransfer: PlayerLassoRoomTransfer | undefined

export function getPlayerLassoThrusterLoad() {
	return activePlayerLassoRuntime?.getThrusterLoad() ?? 0
}

export function preparePlayerLassoRoomTransfer() {
	const runtime = activePlayerLassoRuntime
	const target = runtime?.getTetheredTarget()
	if (!runtime || !target?.exists() || !target.snared) {
		playerLassoRoomTransfer = undefined
		return undefined
	}
	let offset = target.pos.sub(runtime.player.pos)
	const carryDistance = ROPE_LENGTH * 0.72
	if (offset.len() > carryDistance) offset = offset.unit().scale(carryDistance)
	if (offset.len() <= 0.001) offset = k.vec2(0, carryDistance)
	playerLassoRoomTransfer = {
		target,
		offset,
		followPlayer: false,
	}
	target.snareVelocity = k.vec2(0, 0)
	target.consumeSnareRoomImpact()
	return target
}

export function placePlayerLassoRoomTransfer(
	playerPosition: Vec2,
	roomId: string,
	followPlayer: boolean
) {
	const transfer = playerLassoRoomTransfer
	if (!transfer?.target.exists()) {
		playerLassoRoomTransfer = undefined
		return false
	}
	transfer.target.pos = playerPosition.add(transfer.offset)
	transfer.target.snareVelocity = k.vec2(0, 0)
	transfer.target.consumeSnareRoomImpact()
	if (transfer.target.has("gridCollision")) {
		transfer.target.unuse("gridCollision")
		transfer.target.use(gridCollision(ACTIVE_RUN_GRID_KEY))
	}
	transfer.followPlayer = followPlayer
	if (transfer.target.is(tags.persistentShipPart)) {
		transferPersistentShipPartToRoom(
			transfer.target,
			roomId,
			transfer.target.pos
		)
	}
	if (!followPlayer) playerLassoRoomTransfer = undefined
	return true
}

export function syncPlayerLassoRoomTransfer(playerPosition: Vec2) {
	const transfer = playerLassoRoomTransfer
	if (!transfer?.followPlayer || !transfer.target.exists()) return
	transfer.target.pos = playerPosition.add(transfer.offset)
	transfer.target.snareVelocity = k.vec2(0, 0)
	transfer.target.consumeSnareRoomImpact()
}

export function completePlayerLassoRoomTransfer() {
	playerLassoRoomTransfer = undefined
}

export function installPlayerLasso({
	player,
	inputBlocked,
	isUnlocked,
	isStrafeModeActive,
	getStrafeAimPosition,
}: PlayerLassoOptions): InputController {
	let cast: CastState | undefined
	let tether: TetherState | undefined
	const launched: LaunchedState[] = []
	let lastPlayerPosition = player.pos.clone()
	let playerVelocity = k.vec2(0, 0)
	let cancelled = false
	const runtime: ActivePlayerLassoRuntime = {
		player,
		getTetheredTarget: () => tether?.target,
		getThrusterLoad: () => calculateThrusterLoad(tether),
	}
	activePlayerLassoRuntime = runtime

	const visual = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(20),
		tags.gameLoop,
		{
			draw() {
				if (!player.exists()) return
				const end = cast?.hookPosition ?? tether?.target.pos
				if (!end) return
				const tension = tether?.tension ?? 0
				const pulse = 0.72 + Math.sin(k.time() * 14) * 0.12
				k.drawLine({
					p1: player.pos,
					p2: end,
					width: 3,
					color: k.rgb(...UI_COLORS.accent),
					opacity: 0.22 + tension * 0.28,
				})
				k.drawLine({
					p1: player.pos,
					p2: end,
					width: 1,
					color: k.WHITE,
					opacity: Math.min(1, pulse + tension * 0.2),
				})
				k.drawCircle({
					pos: end,
					radius: cast ? 3 : 2,
					fill: false,
					outline: {
						width: 1,
						color: k.WHITE,
					},
				})
			},
		},
	])

	const pressController = onInputActionPress("lasso", () => {
		if (inputBlocked() || !isUnlocked()) return
		if (tether && isStrafeModeActive()) {
			launchTetheredTarget(getStrafeAimPosition())
			return
		}
		if (cast || tether) {
			releaseActiveLasso(true)
			return
		}
		const target = findTarget(player)
		if (!target) return
		const distance = player.pos.dist(target.pos)
		cast = {
			target,
			elapsed: 0,
			duration: k.clamp(
				distance / HOOK_SPEED,
				MIN_HOOK_DURATION,
				MAX_HOOK_DURATION
			),
			hookPosition: player.pos.clone(),
		}
		gameSoundService.play("lasso_throw", {
			volume: mainSoundVolume * 0.65,
		})
	})

	visual.onUpdate(() => {
		if (cancelled || !player.exists()) return
		const frameDelta = Math.min(k.dt() * velocityScale(), MAX_FRAME_DELTA)
		if (frameDelta > 0) {
			playerVelocity = player.pos.sub(lastPlayerPosition).scale(1 / frameDelta)
		}
		lastPlayerPosition = player.pos.clone()

		if (cast) updateCast(frameDelta)
		if (tether) updateTether(frameDelta)
		updateLaunchedTargets(frameDelta)
	})

	function updateCast(deltaSeconds: number) {
		if (!cast) return
		if (
			!cast.target.exists() ||
			!cast.target.canBeSnared() ||
			player.pos.dist(cast.target.pos) > MAX_CAST_RANGE
		) {
			cast = undefined
			return
		}
		cast.elapsed += deltaSeconds
		const progress = k.clamp(cast.elapsed / cast.duration, 0, 1)
		const easedProgress = 1 - Math.pow(1 - progress, 3)
		cast.hookPosition = player.pos.lerp(cast.target.pos, easedProgress)
		if (progress < 1) return

		const target = cast.target
		cast = undefined
		if (!target.beginSnare()) return
		const launchedIndex = launched.findIndex(
			(candidate) => candidate.target.id === target.id
		)
		if (launchedIndex >= 0) launched.splice(launchedIndex, 1)
		tether = {
			target,
			tension: 0,
			activeContacts: new Set(),
			lastImpactAt: new Map(),
			lastRoomImpactAt: -Infinity,
		}
	}

	function updateTether(deltaSeconds: number) {
		if (!tether) return
		if (!tether.target.exists()) {
			tether = undefined
			return
		}
		if (player.pos.dist(tether.target.pos) > BREAK_RANGE) {
			releaseActiveLasso()
			return
		}
		if (deltaSeconds <= 0) return

		let remaining = deltaSeconds
		while (remaining > 0) {
			const step = Math.min(PHYSICS_STEP, remaining)
			const previousPosition = tether.target.pos.clone()
			const previousVelocity = tether.target.snareVelocity.clone()
			advanceTetherPhysics(tether, player.pos, playerVelocity, step)
			const roomImpactVelocity = tether.target.consumeSnareRoomImpact()
			const impactVelocity = strongestVelocity(
				previousVelocity,
				tether.target.snareVelocity,
				roomImpactVelocity
			)
			if (
				roomImpactVelocity &&
				applyDestructibleRoomImpact(tether, roomImpactVelocity)
			) {
				tether = undefined
				return
			}
			resolveSlamImpacts(
				tether,
				previousPosition,
				impactVelocity
			)
			if (!tether.target.exists()) {
				tether = undefined
				return
			}
			remaining -= step
		}
		if (tether) applyTetheredTargetForce(tether, player)
	}

	function releaseActiveLasso(momentumThrow: boolean = false) {
		cast = undefined
		if (!tether) return
		const target = tether.target
		tether = undefined
		if (!target.exists()) return
		let releaseVelocity = momentumThrow
			? target.snareVelocity.scale(LASSO_MOMENTUM_RELEASE_MULTIPLIER)
			: target.snareVelocity.clone()
		if (releaseVelocity.len() > LASSO_THROW_MAX_SPEED) {
			releaseVelocity = releaseVelocity.unit().scale(LASSO_THROW_MAX_SPEED)
		}
		target.releaseSnare(releaseVelocity)
		if (momentumThrow && releaseVelocity.len() >= MIN_SLAM_SPEED) {
			trackLaunchedTarget(target)
			spawnFlash(target.pos.clone(), 5, k.rgb(...UI_COLORS.accent))
			gameSoundService.play("lasso_throw", {
				volume: mainSoundVolume * 0.7,
				detune: -140,
			})
		}
	}

	function launchTetheredTarget(aimPosition: Vec2) {
		if (!tether) return
		const target = tether.target
		const directionToReticle = aimPosition.sub(target.pos)
		const aimFromPlayer = aimPosition.sub(player.pos)
		const direction = directionToReticle.len() > 0.001
			? directionToReticle.unit()
			: aimFromPlayer.len() > 0.001
				? aimFromPlayer.unit()
				: k.vec2(1, 0)
		const carriedMomentum = Math.max(
			0,
			target.snareVelocity.dot(direction)
		) * LASSO_THROW_MOMENTUM_TRANSFER
		const launchSpeed = k.clamp(
			LASSO_THROW_SPEED + carriedMomentum,
			LASSO_THROW_SPEED,
			LASSO_THROW_MAX_SPEED
		)
		const launchVelocity = direction.scale(launchSpeed)
		tether = undefined
		if (!target.exists()) return
		target.releaseSnare(launchVelocity)
		trackLaunchedTarget(target)
		spawnFlash(target.pos.clone(), 6, k.rgb(...UI_COLORS.accent))
		gameSoundService.play("lasso_throw", {
			volume: mainSoundVolume * 0.8,
			detune: -90,
		})
	}

	function trackLaunchedTarget(target: SnareTarget) {
		target.consumeSnareRoomImpact()
		const launchedIndex = launched.findIndex(
			(state) => state.target.id === target.id
		)
		if (launchedIndex >= 0) launched.splice(launchedIndex, 1)
		launched.push({
			target,
			lastPosition: target.pos.clone(),
			elapsed: 0,
			activeContacts: new Set(),
			lastImpactAt: new Map(),
			lastRoomImpactAt: -Infinity,
		})
	}

	function updateLaunchedTargets(deltaSeconds: number) {
		for (let index = launched.length - 1; index >= 0; index--) {
			const state = launched[index]
			if (!state.target.exists() || state.target.snared) {
				launched.splice(index, 1)
				continue
			}
			const currentPosition = state.target.pos.clone()
			const roomImpactVelocity = state.target.consumeSnareRoomImpact()
			if (
				roomImpactVelocity &&
				applyDestructibleRoomImpact(state, roomImpactVelocity)
			) {
				launched.splice(index, 1)
				continue
			}
			resolveSlamImpacts(
				state,
				state.lastPosition,
				state.target.snareVelocity.clone()
			)
			if (!state.target.exists()) {
				launched.splice(index, 1)
				continue
			}
			state.lastPosition = currentPosition
			state.elapsed += deltaSeconds
			if (
				state.elapsed >= LASSO_THROW_TRACK_DURATION ||
				state.target.snareVelocity.len() < MIN_SLAM_SPEED
			) launched.splice(index, 1)
		}
	}

	const cancel = () => {
		if (cancelled) return
		cancelled = true
		pressController.cancel()
		releaseActiveLasso()
		launched.length = 0
		if (activePlayerLassoRuntime === runtime) {
			activePlayerLassoRuntime = undefined
			playerLassoRoomTransfer = undefined
		}
		if (visual.exists()) k.destroy(visual)
	}
	player.onDestroy(cancel)

	return { cancel }
}

function calculateThrusterLoad(tether: TetherState | undefined) {
	if (!tether?.target.exists() || tether.tension <= 0) return 0
	const massLoad = k.clamp(
		(tether.target.snareMass - THRUSTER_LOAD_BASE_MASS) /
			(THRUSTER_LOAD_FULL_MASS - THRUSTER_LOAD_BASE_MASS),
		0,
		1
	)
	const poweredLoad = k.clamp(
		tether.target.snareForce * tether.target.snareMass /
			THRUSTER_LOAD_FULL_FORCE,
		0,
		1
	)
	const workingTension = k.clamp(tether.tension * 4, 0, 1)
	return k.clamp(
		workingTension * (massLoad * 0.65 + poweredLoad * 0.65),
		0,
		1
	)
}

function findTarget(player: GameObj<PosComp>) {
	const pointer = k.toWorld(k.mousePos())
	let closest = wakeSleepingShipPartTarget(pointer, player)
	let closestSurfaceDistance = POINTER_ACQUIRE_RADIUS
	if (closest) {
		closestSurfaceDistance = Math.max(
			0,
			pointer.dist(closest.pos) - closest.snareRadius
		)
	}
	for (const candidate of querySpatialNearby(
		pointer,
		POINTER_ACQUIRE_RADIUS + MAX_QUERY_TARGET_RADIUS,
		{
			allTags: [tags.snareable],
		}
	)) {
		const target = candidate as SnareTarget
		if (
			!target.exists() ||
			!target.canBeSnared() ||
			player.pos.dist(target.pos) > MAX_CAST_RANGE
		) continue
		const surfaceDistance = Math.max(
			0,
			pointer.dist(target.pos) - target.snareRadius
		)
		if (surfaceDistance >= closestSurfaceDistance) continue
		closest = target
		closestSurfaceDistance = surfaceDistance
	}
	return closest
}

function wakeSleepingShipPartTarget(
	pointer: Vec2,
	player: GameObj<PosComp>
): SnareTarget | undefined {
	for (const record of queryPersistentShipParts(
		pointer,
		POINTER_ACQUIRE_RADIUS + MAX_QUERY_TARGET_RADIUS
	)) {
		if (record.active || player.pos.dist(record.position) > MAX_CAST_RANGE) {
			continue
		}
		const radius = k.clamp(8 * record.scale, 5, 16)
		if (Math.max(0, pointer.dist(record.position) - radius) >= POINTER_ACQUIRE_RADIUS) {
			continue
		}
		const part = wakePersistentShipPart(
			record.id,
			k.vec2(1, 0),
			0,
			record.roomId
		)
		return part as SnareTarget | undefined
	}
	return undefined
}

function advanceTetherPhysics(
	tether: TetherState,
	playerPosition: Vec2,
	playerVelocity: Vec2,
	deltaSeconds: number
) {
	const target = tether.target
	const toPlayer = playerPosition.sub(target.pos)
	const distance = toPlayer.len()
	const stretch = Math.max(0, distance - ROPE_LENGTH)
	tether.tension = k.clamp(stretch / (BREAK_RANGE - ROPE_LENGTH), 0, 1)

	if (stretch > 0.001 && distance > 0.001) {
		const direction = toPlayer.scale(1 / distance)
		const relativeVelocity = target.snareVelocity.sub(playerVelocity)
		const radialVelocity = relativeVelocity.dot(direction)
		const tangentialVelocity = relativeVelocity.dot(direction.normal())
		const forceMagnitude = Math.max(
			0,
			stretch * SPRING_STIFFNESS - radialVelocity * SPRING_DAMPING
		)
		const acceleration = direction.scale(forceMagnitude / target.snareMass)
		target.snareVelocity = target.snareVelocity.add(
			acceleration.scale(deltaSeconds)
		)
		const desiredAngularVelocity = tangentialVelocity /
			Math.max(4, target.snareRadius) * 180 / Math.PI
		target.applySnareTorque(
			(desiredAngularVelocity - target.snareAngularVelocity) *
				TETHER_ANGULAR_RESPONSE,
			deltaSeconds
		)
	}

	target.snareVelocity = target.snareVelocity.scale(
		Math.exp(-TETHER_DRAG * deltaSeconds)
	)
	if (target.snareVelocity.len() > MAX_TARGET_SPEED) {
		target.snareVelocity = target.snareVelocity.unit().scale(MAX_TARGET_SPEED)
	}
	target.advanceSnareMotion(deltaSeconds)
}

function applyTetheredTargetForce(
	tether: TetherState,
	player: GameObj<PosComp>
) {
	const target = tether.target
	if (target.snareForce <= 0 || tether.tension <= 0) return
	if (target.snareForceDirection.len() <= 0.001) return
	const pullSpeed = k.clamp(
		target.snareForce * target.snareMass * tether.tension,
		0,
		MAX_PLAYER_PULL_SPEED
	)
	player.move(
		target.snareForceDirection.unit().scale(pullSpeed * velocityScale())
	)
}

function resolveSlamImpacts(
	tether: SlamState,
	previousPosition: Vec2,
	impactVelocity: Vec2
) {
	const target = tether.target
	const currentPosition = target.pos.clone()
	const movement = currentPosition.sub(previousPosition)
	const speed = impactVelocity.len()
	const travelDirection = movement.len() > 0.001
		? movement.unit()
		: speed > 0.001
			? impactVelocity.unit()
			: k.vec2(0, 0)
	const midpoint = previousPosition.lerp(currentPosition, 0.5)
	const queryRadius = movement.len() * 0.5 +
		target.snareRadius + SLAM_QUERY_TARGET_RADIUS
	const nextContacts = new Set<number>()
	let impactCount = 0

	for (const candidate of querySpatialNearby(midpoint, queryRadius, {
		anyTags: [
			tags.enemy,
			tags.roomCover,
			tags.roomVolatile,
			tags.snareable,
		],
		excludeIds: [target.id],
	})) {
		if (
			!candidate.exists() ||
			(candidate.hidden && candidate.dataOrientedVisual !== true)
		) continue
		const candidatePosition = getTargetWorldPosition(
			candidate as GameObj<PosComp>
		)
		const candidateRadius = getSlamTargetRadius(candidate)
		const combinedRadius = target.snareRadius + candidateRadius
		const endpointOverlaps = currentPosition.dist(candidatePosition) <=
			combinedRadius
		if (endpointOverlaps) nextContacts.add(candidate.id)

		const closestPoint = closestPointOnSegment(
			candidatePosition,
			previousPosition,
			currentPosition
		)
		if (closestPoint.dist(candidatePosition) > combinedRadius) continue
		if (speed < MIN_SLAM_SPEED || travelDirection.len() <= 0.001) continue
		if (tether.activeContacts.has(candidate.id)) continue
		const lastImpactAt = tether.lastImpactAt.get(candidate.id)
		if (
			lastImpactAt !== undefined &&
			k.time() - lastImpactAt < SLAM_CONTACT_COOLDOWN
		) continue
		if (!applySlamImpact(
			target,
			candidate,
			closestPoint,
			candidatePosition,
			travelDirection,
			speed
		)) continue
		if (!target.exists()) return
		tether.lastImpactAt.set(candidate.id, k.time())
		impactCount += 1
	}

	tether.activeContacts = nextContacts
	if (impactCount > 0) {
		target.snareVelocity = target.snareVelocity.scale(
			Math.pow(SLAM_VELOCITY_RETENTION, Math.min(impactCount, 2))
		)
	}
	if (tether.lastImpactAt.size > 32) {
		for (const [id, impactedAt] of tether.lastImpactAt) {
			if (k.time() - impactedAt > 2) tether.lastImpactAt.delete(id)
		}
	}
}

function applyAttachedObjectDamage(
	target: SnareTarget,
	impactPosition: Vec2,
	direction: Vec2,
	damage: number
) {
	if (typeof target.hp !== "number" || target.hp <= 0) return false
	const reactionDirection = direction.scale(-1)
	target.detachImpactDirection = reactionDirection
	target.detachImpactPosition = impactPosition.clone()
	const damageApplied = applyDamage(target, damage, {
		position: impactPosition,
		incomingDirection: reactionDirection,
		visualForceOrigin: impactPosition,
	})
	if (damageApplied && target.exists() && target.is(tags.enemy)) {
		applyEnemyProjectileImpact(target, {
			position: impactPosition,
			direction: reactionDirection,
			damage,
			critical: false,
			piercing: false,
			splash: false,
			knockback: 0,
		})
	}
	return damageApplied
}

function applyDestructibleRoomImpact(
	state: SlamState,
	impactVelocity: Vec2
) {
	const target = state.target
	if (
		typeof target.hp !== "number" ||
		target.hp <= 0 ||
		impactVelocity.len() < MIN_SLAM_SPEED
	) return false
	if (k.time() - state.lastRoomImpactAt < SLAM_CONTACT_COOLDOWN) return false
	state.lastRoomImpactAt = k.time()
	const direction = impactVelocity.len() > 0.001
		? impactVelocity.unit()
		: k.vec2(0, 0)
	const impactPosition = target.pos.add(
		direction.scale(target.snareRadius)
	)
	const damage = calculateSlamDamage(
		impactVelocity.len(),
		target.snareMass
	)
	applyAttachedObjectDamage(target, impactPosition, direction, damage)
	return !target.exists()
}

function strongestVelocity(...velocities: Array<Vec2 | undefined>) {
	let strongest = k.vec2(0, 0)
	for (const velocity of velocities) {
		if (velocity && velocity.len() > strongest.len()) strongest = velocity
	}
	return strongest.clone()
}

function applySlamImpact(
	snaredTarget: SnareTarget,
	candidate: GameObj,
	impactPosition: Vec2,
	candidatePosition: Vec2,
	direction: Vec2,
	speed: number
) {
	const snareableCandidate = candidate as GameObj<PosComp | SnareableComp>
	const canPushSnareable = candidate.is(tags.snareable) &&
		!snareableCandidate.snared
	const damageable = typeof candidate.hp === "number" && candidate.hp > 0
	if (!damageable && !canPushSnareable) return false

	const speedRatio = k.clamp(
		(speed - MIN_SLAM_SPEED) / (MAX_SLAM_SPEED - MIN_SLAM_SPEED),
		0,
		1
	)
	const damage = calculateSlamDamage(speed, snaredTarget.snareMass)
	const resistance = candidate.is(tags.boss)
		? 0.2
		: candidate.is(tags.elite)
			? 0.55
			: 1
	const knockback = k.clamp(
		speed * 0.32 * snaredTarget.snareMass * resistance,
		14,
		180
	)

	let damageApplied = false
	if (damageable) {
		candidate.detachImpactDirection = direction.clone()
		candidate.detachImpactPosition = impactPosition.clone()
		damageApplied = applyDamage(candidate, damage, {
			position: impactPosition,
			incomingDirection: direction,
			visualForceOrigin: snaredTarget.pos,
		})
	}

	if (candidate.exists()) {
		if (canPushSnareable) {
			const transferSpeed = speed * 0.68 * snaredTarget.snareMass /
				Math.max(0.1, snareableCandidate.snareMass)
			snareableCandidate.snareVelocity = snareableCandidate.snareVelocity.add(
				direction.scale(transferSpeed)
			)
		} else {
			applyKnockbackImpulse(candidate, direction, knockback)
		}
	}

	if (damageApplied && candidate.is(tags.enemy)) {
		applyEnemyProjectileImpact(candidate, {
			position: impactPosition,
			direction,
			damage,
			critical: speedRatio > 0.88,
			piercing: false,
			splash: false,
			knockback,
		})
	} else {
		spawnFlash(
			impactPosition,
			k.lerp(5, 9, speedRatio),
			k.rgb(...UI_COLORS.accent)
		)
		k.shake(k.lerp(0.35, 1.4, speedRatio))
	}
	emitImpactChips(
		impactPosition,
		candidatePosition,
		direction,
		speed,
		speedRatio > 0.88
	)
	if (snaredTarget.exists()) {
		const attachedImpactPosition = snaredTarget.pos.add(
			direction.scale(snaredTarget.snareRadius)
		)
		applyAttachedObjectDamage(
			snaredTarget,
			attachedImpactPosition,
			direction,
			damage
		)
	}
	return true
}

function calculateSlamDamage(speed: number, mass: number) {
	const speedRatio = k.clamp(
		(speed - MIN_SLAM_SPEED) / (MAX_SLAM_SPEED - MIN_SLAM_SPEED),
		0,
		1
	)
	return Math.round(
		SLAM_BASE_DAMAGE + SLAM_MAX_DAMAGE * speedRatio * Math.sqrt(mass)
	)
}

function getSlamTargetRadius(target: GameObj) {
	if (target.is(tags.snareable) && typeof target.snareRadius === "number") {
		return target.snareRadius
	}
	return Math.max(6, getTargetHitRadius(target))
}

function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared <= 0.0001) return start.clone()
	const progress = k.clamp(point.sub(start).dot(segment) / lengthSquared, 0, 1)
	return start.add(segment.scale(progress))
}
