import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { mass } from "../../comp/mass"
import { snareable } from "../../comp/snareable"
import { timescale } from "../../comp/timescale"
import type {
	RoomEnvironmentArchetypeId,
	RoomEnvironmentObjectPlan,
	RoomFloorRoom,
	RoomScrapFieldPlan,
	RoomScrapFieldPiecePlan,
} from "../../generation/rooms/roomFloorTypes"
import { SeededRNG } from "../../generation/seededRng"
import { CellType, type HexGrid } from "../../grid/hexGrid"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { gridRegistry } from "../../grid/gridRegistry"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import {
	applyDamage,
	getLastCombatCredit,
} from "../../services/combat/damageService"
import { applyExplosionForce } from "../../services/combat/explosionPulseService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { grantUltimateChargeForDestruction } from "../../services/abilities/ultimateAbilityService"
import { isPlayerDamageInvulnerable } from "../../services/player/playerDamageState"
import {
	applyKnockbackImpulse,
	applyProjectileDamage,
} from "../../services/combat/projectileService"
import {
	clearRoomCoverSources,
	registerDynamicRoomCover,
} from "../../services/world/roomCoverService"
import {
	forEachSpatialNearby,
	querySpatialNearby,
} from "../../services/core/runtimeSpatialIndexService"
import {
	damageDestructibleWallsInRadius,
	registerDestructibleWall,
} from "../../services/world/destructibleWallService"
import {
	createReward,
	rollMapEventReward,
} from "../../services/economy/rewardService"
import { registerHitAnimation } from "../../shared"
import { tags } from "../../tags"
import { ASTEROID_SPRITES } from "../../asteroidSprites"
import { setHitSoundProfile } from "../../services/audio/hitSoundService"
import { bounceMovingTerrainOffGrid } from "../../services/world/movingTerrainService"
import { registerPushableInteractionPhysics } from "../../services/world/interactionPhysicsService"
import {
	calculatePhysicsImpact,
	resolvePhysicsImpactDamage,
} from "../../services/world/physicsImpactService"
import {
	spawnExplosionEffect,
	spawnExplosiveBarrelExplosionEffect,
	spawnFlash,
} from "../spawnFlash"
import { getWorldVisual } from "../../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { spawnRockDestructionFragments } from "../../services/combat/rockDestructionEffectService"
import { spawnConcussionPlate } from "./spawnConcussionPlate"
import { spawnSlowdownPlate } from "./spawnSlowdownPlate"
import { spawnTeslaCoilHazard } from "./spawnTeslaCoil"
import { spawnRewardPickup } from "../spawnPowerup"
import {
	getWakeEnvironmentPropProfile,
	requireWakeEnvironmentPropProfile,
	type WakeEnvironmentPropProfile,
} from "../../content/environment/wakeEnvironmentCatalog"

const FLOATING_SCRAP_RADIUS = 14
const FLOATING_SCRAP_MIN_IMPACT_SPEED = 24
const FLOATING_SCRAP_MAX_SPEED = 150
const PHYSICS_IMPACT_COOLDOWN = 0.18
const ROOM_OBJECT_PUSH_QUERY_RADIUS = 96
const FUEL_BURN_HEALTH_THRESHOLD = 0.6
const FUEL_SMOKE_INTERVAL = [0.42, 0.08] as const
const FUEL_FLAME_INTERVAL = [0.3, 0.045] as const
let runtimeFloatingScrapId = 0

interface FloatingScrapSpawnOptions {
	initialVelocity?: Vec2
	movementDrag?: number
	persist?: boolean
	grantsDestructionCharge?: boolean
}

export type EnemyThrowableProp = GameObj & {
	enemyThrowableKind: "scrap" | "barrel"
	enemyCarriedBy?: number
	enemyThrownBy?: number
	enemyThrowVelocity: Vec2
	vel?: Vec2
	speed?: number
	rotVel?: number
	snared?: boolean
	snareVelocity?: Vec2
}

export function findNearestEnemyThrowableProp(pos: Vec2, radius: number) {
	return querySpatialNearby(pos, radius, {
		allTags: [tags.enemyThrowable],
	})
		.filter((candidate) => canEnemyClaimThrowable(candidate as EnemyThrowableProp))
		.sort((a, b) => pos.dist(a.pos) - pos.dist(b.pos))[0] as
			EnemyThrowableProp | undefined
}

export function canEnemyClaimThrowable(
	prop: EnemyThrowableProp | undefined
): prop is EnemyThrowableProp {
	return prop !== undefined &&
		prop.exists() &&
		prop.enemyCarriedBy === undefined &&
		prop.snared !== true
}

export function claimEnemyThrowable(prop: EnemyThrowableProp, carrierId: number) {
	if (!canEnemyClaimThrowable(prop)) return false
	prop.enemyCarriedBy = carrierId
	prop.enemyThrownBy = undefined
	prop.enemyThrowVelocity = k.vec2()
	prop.snared = true
	if (prop.snareVelocity) prop.snareVelocity = k.vec2()
	if (prop.vel) prop.vel = k.vec2()
	if (typeof prop.speed === "number") prop.speed = 0
	if (typeof prop.rotVel === "number") prop.rotVel = 0
	return true
}

export function carryEnemyThrowable(prop: EnemyThrowableProp, position: Vec2) {
	if (prop.exists()) prop.pos = position.clone()
}

export function throwEnemyThrowable(
	prop: EnemyThrowableProp,
	direction: Vec2,
	speed: number,
	throwerId: number
) {
	if (!prop.exists()) return
	const throwDirection = direction.len() > 0.001 ? direction.unit() : k.vec2(0, 1)
	prop.enemyCarriedBy = undefined
	prop.enemyThrownBy = throwerId
	prop.enemyThrowVelocity = throwDirection.scale(speed)
	prop.snared = false
	if (prop.enemyThrowableKind === "scrap") {
		prop.vel = throwDirection
		prop.speed = speed
		prop.rotVel = prop.id % 2 === 0 ? -220 : 220
	}
}

export function releaseEnemyThrowable(prop: EnemyThrowableProp | undefined) {
	if (!prop?.exists()) return
	prop.enemyCarriedBy = undefined
	prop.enemyThrownBy = undefined
	prop.enemyThrowVelocity = k.vec2()
	prop.snared = false
}

export interface ExplodingFuelCellOptions {
	health?: number
	orientation?: number
	extraTags?: string[]
	onExplode?: () => void
}

export function spawnRoomEnvironment(grid: HexGrid, room: RoomFloorRoom) {
	clearRoomCoverSources()
	for (const field of room.environment?.scrapFields ?? []) {
		spawnExplosiveScrapField(grid, field)
	}
	for (const plan of room.environment?.objects ?? []) {
		if (plan.destroyed) continue
		const position = grid.hexToScreen(plan.coord)
		const propProfile = getWakeEnvironmentPropProfile(plan.archetypeId)
		if (
			propProfile?.role === "cover" ||
			plan.category === "structural"
		) {
			spawnDestructibleCover(grid, plan, position)
			continue
		}
		if (plan.archetypeId === "wake-floating-scrap") {
			spawnFloatingScrap(grid, plan, position)
			continue
		}
		if (plan.archetypeId === "wake-concussion-plate") {
			spawnConcussionPlate(grid, plan, position)
			continue
		}
		if (plan.archetypeId === "wake-slowdown-plate") {
			spawnSlowdownPlate(plan, position)
			continue
		}
		if (plan.archetypeId === "wake-tesla-coil") {
			spawnTeslaCoilHazard(position)
			continue
		}
		if (propProfile?.role === "volatile") {
			spawnGeneratedVolatileProp(grid, plan, position, propProfile)
		}
	}
}

export function spawnRuntimeFloatingScrap(
	position: Vec2,
	initialVelocity: Vec2
) {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid) return undefined
	const coord = grid.screenToHex(position)
	if (!grid.inBounds(coord) || !grid.isWalkable(coord)) return undefined
	const plan: RoomEnvironmentObjectPlan = {
		id: `runtime-floating-scrap-${runtimeFloatingScrapId++}`,
		archetypeId: "wake-floating-scrap",
		category: "dynamic-cover",
		coord,
		orientation: Math.floor(k.rand(0, 6)),
		variant: Math.floor(k.rand(0, ASTEROID_SPRITES.length)),
		health: 18,
	}
	return spawnFloatingScrap(grid, plan, position, {
		initialVelocity,
		movementDrag: 22,
		persist: false,
		grantsDestructionCharge: false,
	})
}

function spawnExplosiveScrapField(
	grid: HexGrid,
	field: RoomScrapFieldPlan
) {
	let rewardSpawned = false
	const spawnReward = () => {
		if (rewardSpawned || field.rewardCollected) return
		const reward = resolveScrapFieldReward(field)
		if (!reward) return
		rewardSpawned = true
		spawnRewardPickup(grid.hexToScreen(field.center), reward, {
			stationary: true,
			tags: [tags.runMap, tags.runRoom],
			telemetrySource: "secret",
			onCollected: () => {
				field.rewardCollected = true
			},
		})
	}
	const revealReward = () => {
		if (!field.rewardRevealed) field.rewardRevealed = true
		spawnReward()
	}

	for (const piece of field.scrap) {
		if (piece.destroyed) continue
		spawnExplosiveScrapPiece(grid, piece, revealReward)
	}
	if (field.rewardRevealed) spawnReward()
}

function spawnExplosiveScrapPiece(
	grid: HexGrid,
	piece: RoomScrapFieldPiecePlan,
	onBreached: () => void
) {
	const position = grid.hexToScreen(piece.coord)
	const sprite = ASTEROID_SPRITES[piece.variant % ASTEROID_SPRITES.length]
	const scrap = k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(piece.orientation * 60),
		k.scale(1.45),
		k.color(190, 190, 190),
		k.opacity(1),
		k.layer(layers.game),
		{
			hb: 22,
			explosiveOnly: true,
			rotationSpeed: (piece.variant % 2 === 0 ? 1 : -1) *
				(4 + piece.variant % 5),
			update() {
				this.angle += this.rotationSpeed * k.dt()
			},
		},
		tags.props,
		tags.roomEnvironment,
		tags.roomCover,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
	])
	registerDestructibleWall({
		gridKey: ACTIVE_RUN_GRID_KEY,
		coord: piece.coord,
		worldPos: position,
		maxHp: 1,
		requiresExplosive: true,
		onDestroyed: () => {
			if (piece.destroyed) return
			piece.destroyed = true
			grantUltimateChargeForDestruction("environment", position)
			grid.setCell(piece.coord, CellType.Empty)
			spawnExplosionEffect(position, 34, {
				particleCount: 12,
				persistentSmoke: true,
			})
			spawnRockDestructionFragments(position, 1.05)
			gameSoundService.playPositional("rock_material_destroyed", position, {
				volume: mainSoundVolume * 0.7,
			})
			onBreached()
			if (scrap.exists()) k.destroy(scrap)
		},
	})
	return scrap
}

function resolveScrapFieldReward(field: RoomScrapFieldPlan) {
	if (field.rewardId) {
		return createReward(field.rewardId, field.rewardRarity)
	}
	const rng = new SeededRNG(field.seed)
	const reward = rollMapEventReward(
		field.rewardTier,
		() => rng.nextFloat()
	)
	if (!reward) return undefined
	field.rewardId = reward.id
	field.rewardRarity = reward.rarity
	return reward
}

function spawnDestructibleCover(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	const profile = getWakeEnvironmentPropProfile(plan.archetypeId)
	if (!profile || profile.role !== "cover") return
	const visual = getWorldVisual(profile.visualId)
	const sprite = requirePrimaryVisualSprite(visual)
	const radius = profile.radius
	const coverMass = profile.mass
	const cover = k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(plan.orientation * 60),
		k.color(k.WHITE),
		k.scale(visual.worldScale, visual.worldScaleY ?? visual.worldScale),
		k.opacity(1),
		k.health(plan.health ?? profile.health),
		k.animate(),
		timescale(),
		snareable({
			mass: coverMass,
			radius,
			releaseDrag: 1.7,
			angularDrag: 1.5,
		}),
		{
			hb: radius,
		},
		tags.props,
		tags.unit,
		tags.roomEnvironment,
		tags.roomCover,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	registerHitAnimation(cover)
	setHitSoundProfile(cover, "lightMetal")
	registerDynamicRoomCover(plan.id, cover, radius)
	registerEnvironmentProjectileHits(cover, true)
	registerRoomObjectPushPhysics(cover, radius, coverMass, profile.maxPushSpeed)
	persistObjectState(grid, plan, cover)
	cover.onDeath(() => {
		plan.destroyed = true
		const deathPosition = cover.pos.clone()
		grantUltimateChargeForDestruction("environment", deathPosition)
		spawnExplosionEffect(deathPosition, radius * 1.8, { particleCount: 9 })
		spawnRockDestructionFragments(deathPosition, radius / 24)
		gameSoundService.playPositional("hit2", deathPosition, {
			volume: mainSoundVolume * 0.55,
			detune: -260,
		})
		k.destroy(cover)
	})
	return cover
}

function spawnFloatingScrap(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2,
	options: FloatingScrapSpawnOptions = {}
) {
	const sprite = ASTEROID_SPRITES[plan.variant % ASTEROID_SPRITES.length]
	const initialSpeed = Math.min(
		FLOATING_SCRAP_MAX_SPEED,
		options.initialVelocity?.len() ?? 0
	)
	const initialDirection = initialSpeed > 0
		? options.initialVelocity!.unit()
		: k.vec2(0)
	const scrap = k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(plan.orientation * 60),
		k.scale(0.95),
		k.color(k.WHITE),
		k.opacity(1),
		k.health(plan.health ?? 18),
		k.animate(),
		timescale(),
		mass(1),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		snareable({
			mass: 1.8,
			radius: FLOATING_SCRAP_RADIUS,
			releaseDrag: 1.45,
			onSnareStart: () => {
				scrap.vel = k.vec2(0)
				scrap.speed = 0
				scrap.rotVel = 0
			},
		}),
		{
			hb: FLOATING_SCRAP_RADIUS,
			vel: initialDirection,
			speed: initialSpeed,
			rotVel: initialSpeed > 0 ? k.rand(-130, 130) : 0,
			movementDrag: options.movementDrag ?? 0,
			lastPhysicsImpactAt: -Infinity,
			enemyThrowableKind: "scrap" as const,
			enemyCarriedBy: undefined as number | undefined,
			enemyThrownBy: undefined as number | undefined,
			enemyThrowVelocity: k.vec2(),
		},
		tags.props,
		tags.unit,
		tags.roomEnvironment,
		tags.roomCover,
		tags.enemyThrowable,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	registerHitAnimation(scrap)
	setHitSoundProfile(scrap, "stone")
	registerDynamicRoomCover(plan.id, scrap, FLOATING_SCRAP_RADIUS)
	registerEnvironmentProjectileHits(scrap, true)
	registerRoomObjectPushPhysics(
		scrap,
		FLOATING_SCRAP_RADIUS,
		1.8,
		FLOATING_SCRAP_MAX_SPEED,
		(target) => target.enemyCarriedBy === undefined
	)
	registerFloatingScrapMovement(grid, scrap, sprite)
	if (options.persist !== false) persistObjectState(grid, plan, scrap)
	scrap.onDeath(() => {
		plan.destroyed = true
		if (options.grantsDestructionCharge !== false) {
			grantUltimateChargeForDestruction("environment", scrap.pos)
		}
		spawnExplosionEffect(scrap.pos, 25, { particleCount: 8 })
		gameSoundService.playPositional("rock_material_destroyed", scrap.pos, {
			volume: mainSoundVolume * 0.5,
		})
		spawnRockDestructionFragments(scrap.pos, 0.7)
		k.destroy(scrap)
	})
	return scrap
}

function registerFloatingScrapMovement(
	grid: HexGrid,
	scrap: GameObj,
	sprite: string
) {
	registerBatchedEntityUpdate("world", scrap, () => {
		if (scrap.enemyCarriedBy !== undefined) return
		if (scrap.speed <= 0 || scrap.vel.len() <= 0.001) return
		const moveVelocity = scrap.vel.unit().scale(
			scrap.speed * velocityScale() * scrap.getTimescale()
		)
		if (!bounceMovingTerrainOffGrid(scrap, moveVelocity, grid)) {
			scrap.move(moveVelocity)
		}
		scrap.angle += scrap.rotVel * k.dt() * scrap.getTimescale()
		scrap.speed = Math.max(
			0,
			scrap.speed - scrap.movementDrag * k.dt() * scrap.getTimescale()
		)
		resolveFloatingScrapImpact(scrap, sprite)
	})
}

function resolveFloatingScrapImpact(scrap: GameObj, sprite: string) {
	if (scrap.speed < FLOATING_SCRAP_MIN_IMPACT_SPEED) return
	if (k.time() - scrap.lastPhysicsImpactAt < PHYSICS_IMPACT_COOLDOWN) return
	if (
		!isPlayerDamageInvulnerable() &&
		playerObj.exists() &&
		playerObj.pos.dist(scrap.pos) < scrap.hb + 8
	) {
		applyEnvironmentBodyImpact(scrap, playerObj, {
			velocity: scrap.vel.unit().scale(scrap.speed),
			mass: 1.8,
			sourceName: "FLYING COVER",
			sourceSprite: sprite,
		})
		return
	}

	for (const enemy of querySpatialNearby(scrap.pos, scrap.hb + 34, {
		allTags: [tags.enemy, tags.unit],
	})) {
		if (enemy.id === scrap.enemyThrownBy) continue
		if (!enemy.exists() || typeof enemy.hp !== "number" || enemy.hp <= 0) {
			continue
		}
		const targetRadius = typeof enemy.hb === "number" ? enemy.hb : 10
		if (enemy.pos.dist(scrap.pos) >= scrap.hb + targetRadius) continue
		applyEnvironmentBodyImpact(scrap, enemy, {
			velocity: scrap.vel.unit().scale(scrap.speed),
			mass: 1.8,
			sourceName: "FLYING COVER",
			sourceSprite: sprite,
		})
		return
	}
}

function spawnGeneratedVolatileProp(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2,
	profile: WakeEnvironmentPropProfile
) {
	const fuel = spawnExplodingWakeProp(position, profile, {
		health: plan.health ?? profile.health,
		orientation: plan.orientation * 60,
		extraTags: [tags.runMap, tags.runRoom],
		onExplode: () => {
			plan.destroyed = true
			grantUltimateChargeForDestruction("environment", fuel.pos)
		},
	})
	persistObjectState(grid, plan, fuel)
	return fuel
}

export function spawnExplodingFuelCell(
	position: Vec2,
	options: ExplodingFuelCellOptions = {}
) {
	return spawnExplodingWakeProp(
		position,
		requireWakeEnvironmentPropProfile("wake-fuel-cell"),
		options
	)
}

function spawnExplodingWakeProp(
	position: Vec2,
	profile: WakeEnvironmentPropProfile,
	options: ExplodingFuelCellOptions = {}
) {
	if (!profile.explosion) {
		throw new Error(`Wake volatile prop has no explosion profile: ${profile.archetypeId}`)
	}
	const visual = getWorldVisual(profile.visualId)
	const fuel = k.add([
		k.pos(position),
		k.sprite(requirePrimaryVisualSprite(visual)),
		k.anchor("center"),
		k.rotate(options.orientation ?? 0),
		k.color(205, 215, 220),
		k.scale(visual.worldScale, visual.worldScaleY ?? visual.worldScale),
		k.opacity(0.95),
		k.health(options.health ?? profile.health),
		k.animate(),
		timescale(),
		snareable({
			mass: profile.mass,
			radius: profile.radius,
			releaseDrag: 1.6,
		}),
		{
			hb: profile.radius,
			volatileProfile: profile,
			exploding: false,
			lastPhysicsImpactAt: -Infinity,
			enemyThrowableKind: "barrel" as const,
			enemyCarriedBy: undefined as number | undefined,
			enemyThrownBy: undefined as number | undefined,
			enemyThrowVelocity: k.vec2(),
		},
		tags.props,
		tags.unit,
		tags.roomEnvironment,
		tags.roomVolatile,
		tags.enemyThrowable,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.extraTags ?? []),
	])
	const warning = fuel.add([
		k.circle(profile.radius * 1.5),
		k.anchor("center"),
		k.color(255, 62, 48),
		k.opacity(0.08),
		k.layer(layers.gameEffects),
		k.z(-1),
	])
	let smokeEmitter: ReturnType<typeof createFuelSmokeEmitter> | undefined
	let flameEmitter: ReturnType<typeof createFuelFlameEmitter> | undefined
	let smokeTimer = 0
	let flameTimer = 0
	setHitSoundProfile(fuel, "lightMetal")
	registerHitAnimation(fuel)
	registerEnvironmentProjectileHits(fuel, false, () => {
		warning.opacity = 0.22
	})
	registerRoomObjectPushPhysics(
		fuel,
		profile.radius,
		profile.mass,
		profile.maxPushSpeed,
		(target) =>
		target.exploding !== true &&
		target.enemyCarriedBy === undefined &&
		target.enemyThrowVelocity.len() <= 0.001
	)
	registerBatchedEntityUpdate("effects", fuel, () => {
		updateThrownFuelCell(fuel, profile)
		if (!fuel.exists()) return
		const burnIntensity = getFuelBurnIntensity(fuel.hp, fuel.maxHP)
		warning.opacity = k.wave(
			0.05 + burnIntensity * 0.08,
			0.15 + burnIntensity * 0.3,
			k.time() * (3.5 + burnIntensity * 7)
		)
		if (burnIntensity <= 0) return
		if (!smokeEmitter?.exists()) smokeEmitter = createFuelSmokeEmitter()
		if (!flameEmitter?.exists()) flameEmitter = createFuelFlameEmitter()

		const effectPosition = fuel.pos.add(k.rand(-3, 3), k.rand(-5, 1))
		smokeTimer -= k.dt()
		if (smokeTimer <= 0) {
			smokeEmitter!.emitter.position = effectPosition
			smokeEmitter!.emit(1 + Math.floor(burnIntensity * 2))
			smokeTimer = k.lerp(
				FUEL_SMOKE_INTERVAL[0],
				FUEL_SMOKE_INTERVAL[1],
				burnIntensity
			)
		}

		flameTimer -= k.dt()
		if (flameTimer <= 0) {
			flameEmitter!.emitter.position = effectPosition
			flameEmitter!.emit(1 + Math.floor(burnIntensity * 3))
			flameTimer = k.lerp(
				FUEL_FLAME_INTERVAL[0],
				FUEL_FLAME_INTERVAL[1],
				burnIntensity
			)
		}
	})
	fuel.onDeath(() => explodeFuelCell(fuel, profile, options.onExplode))
	fuel.onDestroy(() => {
		if (smokeEmitter?.exists()) k.destroy(smokeEmitter)
		if (flameEmitter?.exists()) k.destroy(flameEmitter)
	})
	return fuel
}

function registerRoomObjectPushPhysics(
	target: GameObj,
	radius: number,
	objectMass: number,
	maxSpeed: number,
	canPush?: (target: GameObj, pusher: GameObj) => boolean
) {
	registerPushableInteractionPhysics(target, {
		radius,
		mass: objectMass,
		maxSpeed,
		pushTransfer: 0.88,
		separationResponse: 12,
		getPusher: () => playerObj,
		forEachPusher: (visitor) => forEachSpatialNearby(
			target.pos,
			ROOM_OBJECT_PUSH_QUERY_RADIUS + radius,
			{
				anyTags: [tags.enemy, tags.pushable],
				excludeIds: [target.id, playerObj.id],
			},
			visitor
		),
		getPusherRadius: getRoomObjectPusherRadius,
		canPush: (physicsTarget, pusher) =>
			physicsTarget.lassoCollisionOwnerId !== pusher.id &&
			(canPush?.(physicsTarget, pusher) ?? true),
	})
}

function getRoomObjectPusherRadius(pusher: GameObj) {
	if (typeof pusher.snareRadius === "number") {
		return Math.max(6, pusher.snareRadius)
	}
	return typeof pusher.hb === "number" ? Math.max(6, pusher.hb) : 10
}

function updateThrownFuelCell(
	fuel: GameObj,
	profile: WakeEnvironmentPropProfile
) {
	if (
		fuel.enemyCarriedBy !== undefined ||
		fuel.enemyThrowVelocity.len() <= 0.001
	) return
	const delta = k.dt() * fuel.getTimescale()
	const nextPosition = fuel.pos.add(fuel.enemyThrowVelocity.scale(delta))
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (grid) {
		const coord = grid.screenToHex(nextPosition)
		if (!grid.inBounds(coord) || !grid.isWalkable(coord)) {
			applyEnvironmentWallImpact(fuel, fuel.enemyThrowVelocity, profile.mass)
			return
		}
	}
	fuel.pos = nextPosition
	fuel.angle += (fuel.id % 2 === 0 ? -260 : 260) * delta
	if (
		fuel.lassoCollisionOwnerId !== playerObj.id &&
		playerObj.exists() &&
		playerObj.pos.dist(fuel.pos) <= profile.radius + 9
	) {
		applyEnvironmentBodyImpact(fuel, playerObj, {
			velocity: fuel.enemyThrowVelocity,
			mass: profile.mass,
			sourceName: `THROWN ${profile.sourceName}`,
			sourceSprite: requirePrimaryVisualSprite(getWorldVisual(profile.visualId)),
		})
		return
	}
	fuel.enemyThrowVelocity = fuel.enemyThrowVelocity.scale(Math.exp(-0.12 * delta))
}

interface EnvironmentImpactOptions {
	velocity: Vec2
	mass: number
	sourceName: string
	sourceSprite: string
}

function applyEnvironmentBodyImpact(
	body: GameObj,
	target: GameObj,
	options: EnvironmentImpactOptions
) {
	if (
		!body.exists() ||
		!target.exists() ||
		k.time() - body.lastPhysicsImpactAt < PHYSICS_IMPACT_COOLDOWN
	) return false
	const offset = target.pos.sub(body.pos)
	const direction = offset.len() > 0.001
		? offset.unit()
		: options.velocity.len() > 0.001
			? options.velocity.unit()
			: k.vec2(1, 0)
	const relativeSpeed = Math.max(
		0,
		options.velocity.sub(getEnvironmentBodyVelocity(target)).dot(direction)
	)
	const impact = calculatePhysicsImpact(
		relativeSpeed,
		options.mass,
		getEnvironmentBodyMass(target)
	)
	if (impact.damage <= 0) return false
	body.lastPhysicsImpactAt = k.time()
	applyDamage(target, resolvePhysicsImpactDamage(target, impact.damage), {
		position: body.pos,
		incomingDirection: direction,
		playerHullDamage: target.is(tags.player),
		source: { name: options.sourceName, sprite: options.sourceSprite },
		combatCredit: { kind: "environment" },
	})
	if (target.exists()) {
		applyKnockbackImpulse(
			target,
			direction,
			k.clamp(impact.impulse * 0.28, 10, 150)
		)
	}
	applyDamage(body, resolvePhysicsImpactDamage(body, impact.damage), {
		position: body.pos,
		incomingDirection: direction.scale(-1),
		showNumber: false,
		combatCredit: { kind: "environment" },
	})
	if (!body.exists()) return true
	const reboundSpeed = relativeSpeed * 0.28
	if (body.enemyThrowVelocity?.len) {
		body.enemyThrowVelocity = direction.scale(-reboundSpeed)
		body.enemyThrownBy = undefined
	}
	if (body.vel?.len && typeof body.speed === "number") {
		body.vel = direction.scale(-1)
		body.speed = reboundSpeed
	}
	if (body.snareVelocity?.len) {
		body.snareVelocity = direction.scale(-reboundSpeed)
	}
	return true
}

function applyEnvironmentWallImpact(body: GameObj, velocity: Vec2, mass: number) {
	if (
		!body.exists() ||
		k.time() - body.lastPhysicsImpactAt < PHYSICS_IMPACT_COOLDOWN
	) return false
	const impact = calculatePhysicsImpact(velocity.len(), mass)
	if (impact.damage <= 0) return false
	body.lastPhysicsImpactAt = k.time()
	applyDamage(body, resolvePhysicsImpactDamage(body, impact.damage), {
		position: body.pos,
		incomingDirection: velocity.len() > 0.001
			? velocity.unit().scale(-1)
			: undefined,
		showNumber: false,
		combatCredit: { kind: "environment" },
	})
	if (!body.exists()) return true
	if (body.enemyThrowVelocity?.len) {
		body.enemyThrowVelocity = velocity.scale(-0.24)
		body.enemyThrownBy = undefined
	}
	if (body.snareVelocity?.len) body.snareVelocity = velocity.scale(-0.24)
	return true
}

function getEnvironmentBodyVelocity(target: GameObj) {
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

function getEnvironmentBodyMass(target: GameObj) {
	if (typeof target.snareMass === "number") return Math.max(0.1, target.snareMass)
	if (target.is(tags.boss)) return 8
	if (target.is(tags.elite)) return 2.4
	if (target.is(tags.player)) return 1.2
	return 1
}

function createFuelSmokeEmitter() {
	return k.add([
		k.pos(),
		k.particles(
			{
				max: 36,
				speed: [7, 22],
				acceleration: [k.vec2(-3, -18), k.vec2(3, -30)],
				angle: [0, 360],
				lifeTime: [0.55, 1.05],
				colors: [k.rgb(215, 220, 225), k.rgb(58, 64, 70)],
				opacities: [0, 0.72, 0.45, 0],
				scales: [0.35, 1.15, 1.8],
				angularVelocity: [-55, 55],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 65,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(4),
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
	])
}

function createFuelFlameEmitter() {
	return k.add([
		k.pos(),
		k.particles(
			{
				max: 42,
				speed: [18, 48],
				acceleration: [k.vec2(-4, -20), k.vec2(4, -38)],
				angle: [0, 360],
				lifeTime: [0.2, 0.48],
				colors: [
					k.rgb(255, 230, 125),
					k.rgb(255, 105, 30),
					k.rgb(255, 48, 24),
				],
				opacities: [0.95, 0.8, 0],
				scales: [0.8, 1.25, 0.15],
				damping: [1, 2],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 55,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(5),
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
	])
}

function getFuelBurnIntensity(health: number, maxHealth: number) {
	if (maxHealth <= 0) return 1
	const healthRatio = k.clamp(health / maxHealth, 0, 1)
	return k.clamp(
		(FUEL_BURN_HEALTH_THRESHOLD - healthRatio) / FUEL_BURN_HEALTH_THRESHOLD,
		0,
		1
	)
}

function registerEnvironmentProjectileHits(
	target: GameObj,
	pushable: boolean,
	onHit?: () => void
) {
	registerBatchedEntityUpdate("world", target, () => {
		for (const projectileTag of [tags.friendly, tags.enemy]) {
			checkProjectileIntersection(target.pos, target.hb, projectileTag, (projectile) => {
				if (!target.exists() || !projectile.exists()) return
				onHit?.()
				const shouldDestroy = applyProjectileDamage(target, projectile)
				if (pushable && projectile.knockbackStrength > 0) {
					const direction = projectile.dir?.len() > 0.001
						? projectile.dir.unit()
						: target.pos.sub(projectile.pos).unit()
					target.vel = direction
					target.speed = Math.max(
						target.speed ?? 0,
						k.clamp(
							35 + projectile.knockbackStrength * 1.1,
							FLOATING_SCRAP_MIN_IMPACT_SPEED,
							FLOATING_SCRAP_MAX_SPEED
						)
					)
					if (Math.abs(target.rotVel ?? 0) < 0.01) {
						target.rotVel = k.rand(-70, 70)
					}
					applyKnockbackImpulse(
						target,
						direction,
						projectile.knockbackStrength * 0.75
					)
				}
				if (shouldDestroy && projectile.exists()) k.destroy(projectile)
			})
		}
	})
}

function explodeFuelCell(
	fuel: GameObj,
	profile: WakeEnvironmentPropProfile,
	onExplode?: () => void
) {
	if (fuel.exploding) return
	if (!profile.explosion) return
	fuel.exploding = true
	onExplode?.()
	const position = fuel.pos.clone()
	const sourceCredit = getLastCombatCredit(fuel)
	damageDestructibleWallsInRadius(
		position,
		profile.explosion.radius,
		profile.explosion.damage,
		{ explosive: true }
	)
	const targets = querySpatialNearby(position, profile.explosion.radius, {
		anyTags: [tags.player, tags.enemy, tags.roomEnvironment],
		excludeIds: [fuel.id],
	})
	for (const target of targets) {
		if (!target.exists() || typeof target.hp !== "number") continue
		if (
			target.id === playerObj.id &&
			fuel.lassoCollisionOwnerId === playerObj.id
		) continue
		const offset = target.pos.sub(position)
		const distance = offset.len()
		const falloff = 1 - k.clamp(distance / profile.explosion.radius, 0, 1) * 0.55
		applyDamage(target, profile.explosion.damage * falloff, {
			position,
			playerHullDamage: true,
			source: {
				name: profile.sourceName,
				sprite: requirePrimaryVisualSprite(getWorldVisual(profile.visualId)),
			},
			combatCredit: sourceCredit
				? { ...sourceCredit, explosive: true }
				: { kind: "environment", id: profile.archetypeId, explosive: true },
		})
	}
	applyExplosionForce(
		position,
		profile.explosion.radius * 1.15,
		profile.explosion.knockback,
		{ excludeIds: [fuel.id] }
	)
	spawnExplosiveBarrelExplosionEffect(position, profile.explosion.radius)
	gameSoundService.playPositional("explosive_blast", position, {
		volume: mainSoundVolume * 1.1,
		detune: profile.explosion.detune,
	})
	gameSoundService.playPositional("hit2", position, {
		volume: mainSoundVolume * 0.65,
		detune: -360,
	})
	k.shake(k.clamp(profile.explosion.radius / 15, 5, 12))
	k.destroy(fuel)
}

function persistObjectState(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	object: GameObj
) {
	object.onDestroy(() => {
		if (plan.destroyed) return
		plan.health = typeof object.hp === "number" ? object.hp : plan.health
		const coord = grid.screenToHex(object.pos)
		if (grid.inBounds(coord) && grid.isWalkable(coord)) plan.coord = { ...coord }
	})
}
