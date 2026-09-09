import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { timescale } from "../../comp/timescale"
import type { RoomEnvironmentObjectPlan, RoomFloorRoom } from "../../generation/rooms/roomFloorTypes"
import type { HexGrid } from "../../grid/hexGrid"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, layers, mainSoundVolume } from "../../main"
import { applyDamage } from "../../services/damageService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { gameSoundService } from "../../services/gameSoundService"
import {
	applyKnockbackImpulse,
	applyProjectileDamage,
} from "../../services/projectileService"
import {
	clearRoomCoverSources,
	registerDynamicRoomCover,
	registerStaticRoomCover,
} from "../../services/roomCoverService"
import { querySpatialNearby } from "../../services/runtimeSpatialIndexService"
import { registerHitAnimation } from "../../shared"
import { tags } from "../../tags"
import { ASTEROID_SPRITES } from "../../asteroidSprites"
import { setHitSoundProfile } from "../../services/hitSoundService"
import { spawnExplosionEffect } from "../spawnFlash"
import { getWorldVisual } from "../../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"

const FLOATING_SCRAP_RADIUS = 14
const FUEL_CELL_RADIUS = 12
const FUEL_EXPLOSION_RADIUS = 105
const FUEL_EXPLOSION_DAMAGE = 14
const FUEL_EXPLOSION_KNOCKBACK = 82
const FUEL_BURN_HEALTH_THRESHOLD = 0.6
const FUEL_SMOKE_INTERVAL = [0.42, 0.08] as const
const FUEL_FLAME_INTERVAL = [0.3, 0.045] as const
const FUEL_CELL_VISUAL = getWorldVisual("wake-fuel-cell")

export interface ExplodingFuelCellOptions {
	health?: number
	orientation?: number
	extraTags?: string[]
	onExplode?: () => void
}

export function spawnRoomEnvironment(grid: HexGrid, room: RoomFloorRoom) {
	clearRoomCoverSources()
	for (const plan of room.environment?.objects ?? []) {
		if (plan.destroyed) continue
		const position = grid.hexToScreen(plan.coord)
		if (plan.category === "structural") {
			registerStaticRoomCover(plan.id, position, 25)
			continue
		}
		if (plan.archetypeId === "wake-floating-scrap") {
			spawnFloatingScrap(grid, plan, position)
			continue
		}
		if (plan.archetypeId === "wake-fuel-cell") {
			spawnGeneratedFuelCell(grid, plan, position)
		}
	}
}

function spawnFloatingScrap(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	const sprite = ASTEROID_SPRITES[plan.variant % ASTEROID_SPRITES.length]
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
		gridCollision(ACTIVE_RUN_GRID_KEY),
		{
			hb: FLOATING_SCRAP_RADIUS,
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
	registerHitAnimation(scrap)
	setHitSoundProfile(scrap, "stone")
	registerDynamicRoomCover(plan.id, scrap, FLOATING_SCRAP_RADIUS)
	registerEnvironmentProjectileHits(scrap, true)
	persistObjectState(grid, plan, scrap)
	scrap.onDeath(() => {
		plan.destroyed = true
		spawnExplosionEffect(scrap.pos, 25, { particleCount: 8 })
		gameSoundService.playPositional("asteroid_destroyed", scrap.pos, {
			volume: mainSoundVolume * 0.5,
		})
		k.destroy(scrap)
	})
	return scrap
}

function spawnGeneratedFuelCell(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	const fuel = spawnExplodingFuelCell(position, {
		health: plan.health ?? 9,
		orientation: plan.orientation * 60,
		extraTags: [tags.runMap, tags.runRoom],
		onExplode: () => plan.destroyed = true,
	})
	persistObjectState(grid, plan, fuel)
	return fuel
}

export function spawnExplodingFuelCell(
	position: Vec2,
	options: ExplodingFuelCellOptions = {}
) {
	const fuel = k.add([
		k.pos(position),
		k.sprite(requirePrimaryVisualSprite(FUEL_CELL_VISUAL)),
		k.anchor("center"),
		k.rotate(options.orientation ?? 0),
		k.color(205, 215, 220),
		k.scale(FUEL_CELL_VISUAL.worldScale),
		k.opacity(0.95),
		k.health(options.health ?? 9),
		k.animate(),
		timescale(),
		{
			hb: FUEL_CELL_RADIUS,
			exploding: false,
		},
		tags.props,
		tags.unit,
		tags.roomEnvironment,
		tags.roomVolatile,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.extraTags ?? []),
	])
	const warning = fuel.add([
		k.circle(18),
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
	setHitSoundProfile(fuel, "metal")
	registerHitAnimation(fuel)
	registerEnvironmentProjectileHits(fuel, false, () => {
		warning.opacity = 0.22
	})
	registerBatchedEntityUpdate("effects", fuel, () => {
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
	fuel.onDeath(() => explodeFuelCell(fuel, options.onExplode))
	fuel.onDestroy(() => {
		if (smokeEmitter?.exists()) k.destroy(smokeEmitter)
		if (flameEmitter?.exists()) k.destroy(flameEmitter)
	})
	return fuel
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
	onExplode?: () => void
) {
	if (fuel.exploding) return
	fuel.exploding = true
	onExplode?.()
	const position = fuel.pos.clone()
	const targets = querySpatialNearby(position, FUEL_EXPLOSION_RADIUS, {
		anyTags: [tags.player, tags.enemy, tags.roomEnvironment],
		excludeIds: [fuel.id],
	})
	for (const target of targets) {
		if (!target.exists() || typeof target.hp !== "number") continue
		const offset = target.pos.sub(position)
		const distance = offset.len()
		const falloff = 1 - k.clamp(distance / FUEL_EXPLOSION_RADIUS, 0, 1) * 0.55
		applyDamage(target, FUEL_EXPLOSION_DAMAGE * falloff, {
			position,
			playerHullDamage: true,
			source: { name: "VOLATILE FUEL CELL", sprite: "wake_fuel_cell" },
		})
		if (offset.len() > 0.001) {
			applyKnockbackImpulse(
				target,
				offset.unit(),
				FUEL_EXPLOSION_KNOCKBACK * falloff
			)
		}
	}
	spawnExplosionEffect(position, FUEL_EXPLOSION_RADIUS, {
		color: k.rgb(255, 78, 45),
		ringIntensity: 0.75,
		particleCount: 24,
	})
	gameSoundService.playPositional("explosion4", position, {
		volume: mainSoundVolume,
	})
	k.shake(4)
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
