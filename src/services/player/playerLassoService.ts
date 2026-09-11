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
import { applyStunEffect } from "../combat/projectileService"
import {
	getEffectiveUpgradeLevel,
	getToolUpgradeLvlValue,
	getToolUpgradeStatValue,
} from "../../upg"
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
import { getPilotProtocolValue } from "../hub/pilotProtocolService"
import { getLassoRigValue } from "../hub/lassoRigService"
import {
	calculatePhysicsImpact,
	resolvePhysicsImpactDamage,
} from "../world/physicsImpactService"
import {
	queryPullableShipParts,
	type PullableShipPartTarget,
} from "../combat/shipPartPullService"
import type { CombatTargetRuntimeState } from "../combat/combatTarget"

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
const THRUSTER_LOAD_BASE_MASS = 1
const THRUSTER_LOAD_FULL_MASS = 3.5
const THRUSTER_LOAD_FULL_FORCE = 630
const REDLINE_TENSION_THRESHOLD = 0.55
const REDLINE_CHARGE_TIME = 0.75
const REDLINE_CHARGE_DECAY = 1.5
const REDLINE_THROW_MAX_SPEED = 1125
const REDLINE_COLOR = [255, 58, 48] as const
const BASE_LASSO_PULL_FORCE = 100
const MIN_PART_PULL_TENSION = 0.18
const PART_PULL_PROGRESS_DECAY = 0.8
const PART_SHAKE_START_PROGRESS = 0.55

type SnareTarget = GameObj<PosComp | SnareableComp> &
	CombatTargetRuntimeState

type LassoCastTarget =
	| { kind: "snareable"; target: SnareTarget }
	| { kind: "shipPart"; target: PullableShipPartTarget }

interface PlayerLassoOptions {
	player: GameObj<PosComp>
	inputBlocked: () => boolean
	isUnlocked: () => boolean
	canPullShipParts: () => boolean
	isStrafeModeActive: () => boolean
	getStrafeAimPosition: () => Vec2
}

interface CastState {
	target: LassoCastTarget
	elapsed: number
	duration: number
	hookPosition: Vec2
}

interface PartPullState {
	target: PullableShipPartTarget
	tension: number
	progress: number
	nextStrainEffectAt: number
}

interface SlamState {
	target: SnareTarget
	activeContacts: Set<number>
	lastImpactAt: Map<number, number>
	lastRoomImpactAt: number
	damageMultiplier?: number
}

interface TetherState extends SlamState {
	tension: number
	nextArcPulseAt: number
	redlineCharge: number
	redlineReady: boolean
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

function spawnArcHarpoonLightning(start: Vec2, end: Vec2) {
	let remaining = 0.13
	const visual = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(24),
		tags.gameLoop,
		{
			draw() {
				const direction = end.sub(start)
				const normal = direction.len() > 0.001
					? k.vec2(-direction.y, direction.x).unit()
					: k.vec2(0, 1)
				let previous = start
				for (let index = 1; index <= 6; index++) {
					const progress = index / 6
					const point = index === 6
						? end
						: start.lerp(end, progress).add(
							normal.scale(k.rand(-7, 7))
						)
					k.drawLine({
						p1: previous,
						p2: point,
						width: 2,
						color: k.rgb(80, 220, 255),
						opacity: k.clamp(remaining / 0.13, 0, 1),
					})
					previous = point
				}
			},
		},
	])
	visual.onUpdate(() => {
		remaining -= k.dt()
		if (remaining <= 0 && visual.exists()) k.destroy(visual)
	})
}

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
	canPullShipParts,
	isStrafeModeActive,
	getStrafeAimPosition,
}: PlayerLassoOptions): InputController {
	let cast: CastState | undefined
	let tether: TetherState | undefined
	let partPull: PartPullState | undefined
	const launched: LaunchedState[] = []
	let lastPlayerPosition = player.pos.clone()
	let playerVelocity = k.vec2(0, 0)
	let cancelled = false
	const runtime: ActivePlayerLassoRuntime = {
		player,
		getTetheredTarget: () => tether?.target,
		getThrusterLoad: () => calculateThrusterLoad(tether, partPull),
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
				const end = cast?.hookPosition ??
					tether?.target.pos ??
					partPull?.target.getPosition()
				if (!end) return
				const tension = tether?.tension ?? partPull?.tension ?? 0
				const redlineReady = tether?.redlineReady === true
				const partAboutToBreak =
					(partPull?.progress ?? 0) >= PART_SHAKE_START_PROGRESS
				const partUnderpowered = partPull !== undefined &&
					partPull.tension >= MIN_PART_PULL_TENSION &&
					getAvailableLassoPullForce(partPull.tension) <
						partPull.target.pullForce
				const pulse = 0.72 + Math.sin(k.time() * 14) * 0.12
				k.drawLine({
					p1: player.pos,
					p2: end,
					width: redlineReady || partAboutToBreak ? 4 : 3,
					color: redlineReady || partAboutToBreak
						? k.rgb(...REDLINE_COLOR)
						: partUnderpowered
							? k.rgb(...UI_COLORS.warning)
							: k.rgb(...UI_COLORS.accent),
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
		if (cast || tether || partPull) {
			releaseActiveLasso(true)
			return
		}
		const target = findTarget(player, canPullShipParts())
		if (!target) return
		const distance = player.pos.dist(getCastTargetPosition(target))
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
		if (partPull) updatePartPull(frameDelta)
		if (tether) updateTether(frameDelta)
		updateLaunchedTargets(frameDelta)
	})

	function updateCast(deltaSeconds: number) {
		if (!cast) return
		const targetPosition = getCastTargetPosition(cast.target)
		if (
			!isCastTargetAvailable(cast.target) ||
			player.pos.dist(targetPosition) > MAX_CAST_RANGE
		) {
			cast = undefined
			return
		}
		cast.elapsed += deltaSeconds
		const progress = k.clamp(cast.elapsed / cast.duration, 0, 1)
		const easedProgress = 1 - Math.pow(1 - progress, 3)
		cast.hookPosition = player.pos.lerp(targetPosition, easedProgress)
		if (progress < 1) return

		const target = cast.target
		cast = undefined
		if (target.kind === "shipPart") {
			partPull = {
				target: target.target,
				tension: 0,
				progress: 0,
				nextStrainEffectAt: 0,
			}
			return
		}
		if (!target.target.beginSnare()) return
		const launchedIndex = launched.findIndex(
			(candidate) => candidate.target.id === target.target.id
		)
		if (launchedIndex >= 0) launched.splice(launchedIndex, 1)
		tether = createTetherState(target.target)
	}

	function updatePartPull(deltaSeconds: number) {
		const activePull = partPull
		if (!activePull) return
		if (!activePull.target.isAvailable()) {
			partPull = undefined
			return
		}
		const partPosition = activePull.target.getPosition()
		const toPart = partPosition.sub(player.pos)
		const distance = toPart.len()
		if (distance > BREAK_RANGE) {
			partPull = undefined
			return
		}
		const stretch = Math.max(0, distance - ROPE_LENGTH)
		activePull.tension = k.clamp(
			stretch / (BREAK_RANGE - ROPE_LENGTH),
			0,
			1
		)
		if (activePull.tension > 0 && distance > 0.001) {
			const resistanceSpeed = k.clamp(
				activePull.target.pullForce * activePull.tension,
				0,
				MAX_PLAYER_PULL_SPEED
			)
			player.move(toPart.scale(
				resistanceSpeed * velocityScale() / distance
			))
		}

		const availableForce = getAvailableLassoPullForce(activePull.tension)
		if (
			activePull.tension < MIN_PART_PULL_TENSION ||
			availableForce < activePull.target.pullForce
		) {
			activePull.progress = Math.max(
				0,
				activePull.progress - PART_PULL_PROGRESS_DECAY * deltaSeconds
			)
			return
		}

		const forceRatio = k.clamp(
			availableForce / activePull.target.pullForce,
			1,
			1.5
		)
		activePull.progress = Math.min(
			1,
			activePull.progress +
				deltaSeconds * forceRatio / activePull.target.pullDuration
		)
		if (
			activePull.progress >= PART_SHAKE_START_PROGRESS &&
			k.time() >= activePull.nextStrainEffectAt
		) {
			const breakProgress = k.clamp(
				(activePull.progress - PART_SHAKE_START_PROGRESS) /
					(1 - PART_SHAKE_START_PROGRESS),
				0,
				1
			)
			activePull.nextStrainEffectAt = k.time() + k.lerp(
				0.15,
				0.045,
				breakProgress
			)
			if (typeof activePull.target.obj.jitter === "function") {
				activePull.target.obj.jitter(k.lerp(1.5, 4.5, breakProgress))
			}
			const pullDirection = player.pos.sub(partPosition).unit()
			spawnFlash(
				partPosition,
				k.lerp(2.5, 5, breakProgress),
				breakProgress > 0.72 ? k.rgb(...REDLINE_COLOR) : k.WHITE
			)
			emitImpactChips(
				partPosition,
				activePull.target.owner.pos,
				pullDirection,
				k.lerp(150, 360, breakProgress),
				breakProgress > 0.8
			)
		}
		if (activePull.progress < 1) return

		const pullDirection = player.pos.sub(partPosition)
		const detachedTarget = activePull.target.detach(
			pullDirection.len() > 0.001 ? pullDirection.unit() : k.vec2(1, 0)
		) as SnareTarget | undefined
		partPull = undefined
		if (!detachedTarget?.exists() || !detachedTarget.beginSnare()) return
		detachedTarget.pos = partPosition
		detachedTarget.snareVelocity = k.vec2(0, 0)
		tether = createTetherState(detachedTarget)
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
		const pullAccelerationMultiplier =
			(getToolUpgradeLvlValue("torqueSpool") ?? 1) *
			getLassoRigValue("forceAmplifier")

		let remaining = deltaSeconds
		while (remaining > 0) {
			const step = Math.min(PHYSICS_STEP, remaining)
			const previousPosition = tether.target.pos.clone()
			const previousVelocity = tether.target.snareVelocity.clone()
			advanceTetherPhysics(
				tether,
				player.pos,
				playerVelocity,
				step,
				pullAccelerationMultiplier
			)
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
		if (tether) {
			updateRedlineCharge(tether, deltaSeconds)
			applyTetheredTargetForce(tether, player)
			updateArcHarpoon(tether)
		}
	}

	function updateArcHarpoon(activeTether: TetherState) {
		if (
			getEffectiveUpgradeLevel("arcHarpoon") === undefined ||
			k.time() < activeTether.nextArcPulseAt
		) return
		activeTether.nextArcPulseAt = k.time() + 0.48
		const source = activeTether.target
		const targets = querySpatialNearby(source.pos, 112, {
			allTags: [tags.unit, tags.enemy],
		})
			.filter((target) => target.exists())
			.sort((a, b) => source.pos.dist(a.pos) - source.pos.dist(b.pos))
			.slice(0, 2)
		for (const target of targets) {
			applyDamage(target, target.id === source.id ? 2 : 1.25, {
				position: source.pos,
			})
			applyStunEffect(target, { chance: 1, duration: 0.24 })
			spawnArcHarpoonLightning(source.pos, target.pos)
		}
	}

	function releaseActiveLasso(momentumThrow: boolean = false) {
		cast = undefined
		partPull = undefined
		if (!tether) return
		const target = tether.target
		tether = undefined
		if (!target.exists()) return
		let releaseVelocity = momentumThrow
			? target.snareVelocity.scale(LASSO_MOMENTUM_RELEASE_MULTIPLIER)
			: target.snareVelocity.clone()
		releaseVelocity = releaseVelocity.scale(
			1 + getPilotProtocolValue("tetherMomentum") / 100
		)
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
		const redlineReady = tether.redlineReady &&
			getEffectiveUpgradeLevel("redlineCable") !== undefined
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
		const baseLaunchSpeed = k.clamp(
			LASSO_THROW_SPEED + carriedMomentum,
			LASSO_THROW_SPEED,
			LASSO_THROW_MAX_SPEED
		)
		const rigForceMultiplier = getLassoRigValue("forceAmplifier")
		const launchSpeedMultiplier = rigForceMultiplier * (redlineReady
			? getToolUpgradeStatValue(
				"redlineCable",
				"lassoRedlineLaunchSpeedMultiplier"
			) ?? 1.25
			: 1)
		const maximumLaunchSpeed = (redlineReady
			? REDLINE_THROW_MAX_SPEED
			: LASSO_THROW_MAX_SPEED) * rigForceMultiplier
		const launchSpeed = k.clamp(
			baseLaunchSpeed * launchSpeedMultiplier,
			LASSO_THROW_SPEED,
			maximumLaunchSpeed
		)
		const launchVelocity = direction.scale(
			launchSpeed * (1 + getPilotProtocolValue("tetherMomentum") / 100)
		)
		const damageMultiplier = redlineReady
			? getToolUpgradeStatValue(
				"redlineCable",
				"lassoRedlineDamageMultiplier"
			) ?? 1.35
			: 1
		tether = undefined
		if (!target.exists()) return
		target.releaseSnare(launchVelocity)
		trackLaunchedTarget(target, damageMultiplier)
		spawnFlash(
			target.pos.clone(),
			redlineReady ? 9 : 6,
			redlineReady ? k.rgb(...REDLINE_COLOR) : k.rgb(...UI_COLORS.accent)
		)
		if (redlineReady) k.shake(1.2)
		gameSoundService.play("lasso_throw", {
			volume: mainSoundVolume * 0.8,
			detune: -90,
		})
	}

	function trackLaunchedTarget(
		target: SnareTarget,
		damageMultiplier: number = 1
	) {
		target.consumeSnareRoomImpact()
		target.lassoCollisionOwnerId = player.id
		const launchedIndex = launched.findIndex(
			(state) => state.target.id === target.id
		)
		if (launchedIndex >= 0) launched.splice(launchedIndex, 1)
		launched.push({
			target,
			damageMultiplier,
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
				clearLassoCollisionOwner(state.target, player.id)
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
			) {
				launched.splice(index, 1)
			}
		}
	}

	const cancel = () => {
		if (cancelled) return
		cancelled = true
		pressController.cancel()
		releaseActiveLasso()
		for (const state of launched) {
			clearLassoCollisionOwner(state.target, player.id)
		}
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

function clearLassoCollisionOwner(target: GameObj, ownerId: number) {
	if (!target.exists() || target.lassoCollisionOwnerId !== ownerId) return
	target.lassoCollisionOwnerId = undefined
}

function calculateThrusterLoad(
	tether: TetherState | undefined,
	partPull: PartPullState | undefined
) {
	if (partPull?.target.isAvailable() && partPull.tension > 0) {
		const resistanceLoad = k.clamp(partPull.target.pullForce / 150, 0, 1)
		return k.clamp(partPull.tension * resistanceLoad, 0, 1)
	}
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

function createTetherState(target: SnareTarget): TetherState {
	return {
		target,
		tension: 0,
		activeContacts: new Set(),
		lastImpactAt: new Map(),
		lastRoomImpactAt: -Infinity,
		nextArcPulseAt: 0,
		redlineCharge: 0,
		redlineReady: false,
	}
}

function getAvailableLassoPullForce(tension: number) {
	if (tension < MIN_PART_PULL_TENSION) return 0
	const forceMultiplier = getToolUpgradeStatValue(
		"torqueSpool",
		"lassoPullForceMultiplier"
	) ?? 1
	return BASE_LASSO_PULL_FORCE * forceMultiplier *
		getLassoRigValue("forceAmplifier") * k.lerp(0.55, 1, tension)
}

function updateRedlineCharge(tether: TetherState, deltaSeconds: number) {
	if (getEffectiveUpgradeLevel("redlineCable") === undefined) {
		tether.redlineCharge = 0
		tether.redlineReady = false
		return
	}
	if (tether.redlineReady) return
	if (tether.tension >= REDLINE_TENSION_THRESHOLD) {
		tether.redlineCharge = Math.min(
			REDLINE_CHARGE_TIME,
			tether.redlineCharge + deltaSeconds
		)
	} else {
		tether.redlineCharge = Math.max(
		0,
			tether.redlineCharge - deltaSeconds * REDLINE_CHARGE_DECAY
		)
	}
	if (tether.redlineCharge < REDLINE_CHARGE_TIME) return
	tether.redlineReady = true
	spawnFlash(tether.target.pos.clone(), 7, k.rgb(...REDLINE_COLOR))
	k.shake(0.45)
}

function findTarget(player: GameObj<PosComp>, canPullShipParts: boolean) {
	const pointer = k.toWorld(k.mousePos())
	const sleepingPart = wakeSleepingShipPartTarget(pointer, player)
	let closest: LassoCastTarget | undefined = sleepingPart
		? { kind: "snareable", target: sleepingPart }
		: undefined
	let closestSurfaceDistance = POINTER_ACQUIRE_RADIUS
	if (sleepingPart) {
		closestSurfaceDistance = Math.max(
			0,
			pointer.dist(sleepingPart.pos) - sleepingPart.snareRadius
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
		closest = { kind: "snareable", target }
		closestSurfaceDistance = surfaceDistance
	}
	if (!canPullShipParts) return closest
	for (const target of queryPullableShipParts(
		pointer,
		POINTER_ACQUIRE_RADIUS + MAX_QUERY_TARGET_RADIUS
	)) {
		const targetPosition = target.getPosition()
		if (player.pos.dist(targetPosition) > MAX_CAST_RANGE) continue
		const surfaceDistance = Math.max(
			0,
			pointer.dist(targetPosition) - target.hitRadius
		)
		if (surfaceDistance >= closestSurfaceDistance) continue
		closest = { kind: "shipPart", target }
		closestSurfaceDistance = surfaceDistance
	}
	return closest
}

function getCastTargetPosition(target: LassoCastTarget) {
	return target.kind === "shipPart"
		? target.target.getPosition()
		: target.target.pos
}

function isCastTargetAvailable(target: LassoCastTarget) {
	return target.kind === "shipPart"
		? target.target.isAvailable()
		: target.target.exists() && target.target.canBeSnared()
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
	deltaSeconds: number,
	pullAccelerationMultiplier: number
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
		const acceleration = direction.scale(
			forceMagnitude / target.snareMass * pullAccelerationMultiplier
		)
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
			speed,
			tether.damageMultiplier ?? 1
		)) continue
		if (!target.exists()) return
		tether.lastImpactAt.set(candidate.id, k.time())
		impactCount += 1
	}

	tether.activeContacts = nextContacts
	if (impactCount > 0) {
		const retentionBonus = tether.damageMultiplier !== undefined
			? getToolUpgradeLvlValue("momentumRelay") ?? 0
			: 0
		const velocityRetention = k.clamp(
			SLAM_VELOCITY_RETENTION + retentionBonus,
			SLAM_VELOCITY_RETENTION,
			0.95
		)
		target.snareVelocity = target.snareVelocity.scale(
			Math.pow(velocityRetention, Math.min(impactCount, 2))
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
	const selfDamageReduction = k.clamp(
		getToolUpgradeLvlValue("shockCradle") ?? 0,
		0,
		0.8
	)
	const appliedDamage = target.is(tags.roomVolatile)
		? resolvePhysicsImpactDamage(target, damage)
		: damage * (1 - selfDamageReduction)
	const damageApplied = applyDamage(target, appliedDamage, {
		position: impactPosition,
		incomingDirection: reactionDirection,
		visualForceOrigin: impactPosition,
		combatCredit: { kind: "lasso" },
	})
	if (damageApplied && target.exists() && target.is(tags.enemy)) {
		applyEnemyProjectileImpact(target, {
			position: impactPosition,
			direction: reactionDirection,
			damage: appliedDamage,
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
	const damage = calculatePhysicsImpact(
		impactVelocity.len(),
		target.snareMass
	).damage
	if (damage <= 0) return false
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
	speed: number,
	damageMultiplier: number
) {
	const snareableCandidate = candidate as GameObj<PosComp | SnareableComp>
	const canPushSnareable = candidate.is(tags.snareable) &&
		!snareableCandidate.snared
	const damageable = typeof candidate.hp === "number" && candidate.hp > 0
	if (!damageable && !canPushSnareable) return false

	const candidateVelocity = getPhysicsBodyVelocity(candidate)
	const candidateMass = getPhysicsBodyMass(candidate)
	const relativeSpeed = Math.max(
		0,
		direction.scale(speed).sub(candidateVelocity).dot(direction)
	)
	const impact = calculatePhysicsImpact(
		relativeSpeed,
		getEffectiveLassoImpactMass(snaredTarget),
		candidateMass
	)
	if (impact.damage <= 0) return false
	const speedRatio = k.clamp(
		(relativeSpeed - MIN_SLAM_SPEED) / (MAX_SLAM_SPEED - MIN_SLAM_SPEED),
		0,
		1
	)
	const selfDamage = calculatePhysicsImpact(
		relativeSpeed,
		snaredTarget.snareMass,
		candidateMass
	).damage
	const kineticCouplerMultiplier =
		getToolUpgradeLvlValue("kineticCoupler") ?? 1
	const damage = Math.round(
		impact.damage * kineticCouplerMultiplier * damageMultiplier
	)
	const resistance = candidate.is(tags.boss)
		? 0.2
		: candidate.is(tags.elite)
			? 0.55
			: 1
	const knockback = k.clamp(
		speed * 0.32 * getEffectiveLassoImpactMass(snaredTarget) * resistance,
		14,
		180
	)

	let damageApplied = false
	if (damageable) {
		candidate.detachImpactDirection = direction.clone()
		candidate.detachImpactPosition = impactPosition.clone()
		damageApplied = applyDamage(
			candidate,
			resolvePhysicsImpactDamage(candidate, damage),
			{
				position: impactPosition,
				incomingDirection: direction,
				visualForceOrigin: snaredTarget.pos,
				combatCredit: { kind: "lasso" },
			}
		)
	}

	if (candidate.exists()) {
		if (canPushSnareable) {
			const transferSpeed = speed * 0.68 *
				getEffectiveLassoImpactMass(snaredTarget) /
				Math.max(0.1, snareableCandidate.snareMass)
			snareableCandidate.snareVelocity = snareableCandidate.snareVelocity.add(
				direction.scale(transferSpeed)
			)
			if (snareableCandidate.snareVelocity.len() > MAX_TARGET_SPEED) {
				snareableCandidate.snareVelocity =
					snareableCandidate.snareVelocity.unit().scale(MAX_TARGET_SPEED)
			}
			const impactOffset = impactPosition.sub(candidatePosition)
			const torqueLever = impactOffset.x * direction.y -
				impactOffset.y * direction.x
			snareableCandidate.snareAngularVelocity = k.clamp(
				snareableCandidate.snareAngularVelocity +
					torqueLever * transferSpeed /
					Math.max(4, snareableCandidate.snareRadius) * 3,
				-540,
				540
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
			selfDamage
		)
	}
	return true
}

function getPhysicsBodyVelocity(target: GameObj) {
	if (target.snareVelocity?.len) return target.snareVelocity as Vec2
	if (target.enemyThrowVelocity?.len) return target.enemyThrowVelocity as Vec2
	if (target.velocity?.len) return target.velocity as Vec2
	if (target.vel?.len && typeof target.speed === "number") {
		const velocity = target.vel as Vec2
		return velocity.len() > 0.001
			? velocity.unit().scale(target.speed)
			: k.vec2()
	}
	return k.vec2()
}

function getPhysicsBodyMass(target: GameObj) {
	if (typeof target.snareMass === "number") return Math.max(0.1, target.snareMass)
	if (target.is(tags.boss)) return 8
	if (target.is(tags.elite)) return 2.4
	if (target.is(tags.player)) return 1.2
	return 1
}

function getEffectiveLassoImpactMass(target: SnareTarget) {
	return target.snareMass * getLassoRigValue("massCoupler")
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
