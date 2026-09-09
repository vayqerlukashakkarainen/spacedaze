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
const FUEL_CELL_VISUAL = getWorldVisual("wake-fuel-cell")

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
			spawnFuelCell(grid, plan, position)
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
		k.color(145, 162, 171),
		k.opacity(0.9),
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

function spawnFuelCell(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	const fuel = k.add([
		k.pos(position),
		k.sprite(requirePrimaryVisualSprite(FUEL_CELL_VISUAL)),
		k.anchor("center"),
		k.rotate(plan.orientation * 60),
		k.color(205, 215, 220),
		k.scale(FUEL_CELL_VISUAL.worldScale),
		k.opacity(0.95),
		k.health(plan.health ?? 9),
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
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	const warning = fuel.add([
		k.circle(18),
		k.anchor("center"),
		k.color(255, 62, 48),
		k.opacity(0.08),
		k.layer(layers.gameEffects),
		k.z(-1),
	])
	setHitSoundProfile(fuel, "metal")
	registerHitAnimation(fuel)
	registerEnvironmentProjectileHits(fuel, false, () => {
		warning.opacity = 0.22
	})
	registerBatchedEntityUpdate("effects", fuel, () => {
		warning.opacity = k.wave(0.05, 0.15, k.time() * 3.5)
	})
	persistObjectState(grid, plan, fuel)
	fuel.onDeath(() => explodeFuelCell(plan, fuel))
	return fuel
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
	plan: RoomEnvironmentObjectPlan,
	fuel: GameObj
) {
	if (fuel.exploding) return
	fuel.exploding = true
	plan.destroyed = true
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
