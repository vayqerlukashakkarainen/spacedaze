import type { GameObj, PosComp, Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
} from "../services/enemies/enemyNavigationService"
import { clearPlayerStatusEffectsFromSource } from "../services/player/playerStatusEffectService"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import {
	acquireRoomCover,
	releaseRoomCover,
	updateRoomCoverDestination,
} from "../services/world/roomCoverService"
import { spawnEnemyBlaster } from "../services/combat/projectileHelpers"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/enemies/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

const SUPPRESSOR_VISUAL = getEnemyVisual("suppressor")

type Suppressor = GameObj<PosComp> & {
	damage: number
}

export function spawnSuppressor(pos: Vec2, hp = 6, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, SUPPRESSOR_VISUAL.worldScale, options)
	const suppressor = k.add([
		k.pos(pos), k.sprite(requirePrimaryVisualSprite(SUPPRESSOR_VISUAL)), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 14 * profile.scale,
			damage: profile.damage,
			shieldFireRateMultiplier: 1,
			moveDirection: k.vec2(0, 1),
			facingDirection: k.vec2(0, 1),
			fireTimer: k.rand(0.7, 1.4),
			wideFan: false,
			coverTimer: k.rand(1.4, 2.8),
			coverHold: 0,
			coverSourceId: undefined as string | undefined,
			coverTarget: undefined as Vec2 | undefined,
		},
		tags.enemy, tags.unit, tags.enemyRoleController,
		...(profile.elite ? [tags.elite] : []), tags.gameLoop, ...(options.tags ?? []),
	])
	registerEnemyLifecycle(suppressor, profile, 7, 1.45)
	suppressor.onDestroy(() => {
		clearPlayerStatusEffectsFromSource(suppressor.id)
		releaseRoomCover(suppressor.id)
	})
	registerBatchedEntityUpdate("enemies", suppressor, () => {
		const delta = k.dt() * suppressor.getTimescale()
		const toPlayer = playerObj.pos.sub(suppressor.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		let movement = distance < 220
			? direction.scale(-1)
			: distance > 330
				? direction
				: direction.normal().scale(0.55)
		const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
		suppressor.coverTimer -= delta
		if (grid && suppressor.coverSourceId) {
			const target = updateRoomCoverDestination(
				suppressor.coverSourceId,
				playerObj.pos,
				grid
			)
			if (!target) {
				releaseRoomCover(suppressor.id, suppressor.coverSourceId)
				suppressor.coverSourceId = undefined
				suppressor.coverTarget = undefined
				suppressor.coverTimer = 2.5
			} else {
				suppressor.coverTarget = target
				const toCover = target.sub(suppressor.pos)
				if (toCover.len() > 14) {
					movement = toCover.unit()
					suppressor.coverHold = 0
				} else {
					movement = k.vec2(0)
					suppressor.coverHold += delta
					if (suppressor.coverHold >= 0.9) {
						releaseRoomCover(suppressor.id, suppressor.coverSourceId)
						suppressor.coverSourceId = undefined
						suppressor.coverTarget = undefined
						suppressor.coverTimer = k.rand(3.5, 5.5)
					}
				}
			}
		} else if (
			grid &&
			suppressor.coverTimer <= 0 &&
			distance >= 150 &&
			distance <= 440
		) {
			const cover = acquireRoomCover(
				suppressor.id,
				suppressor.pos,
				playerObj.pos,
				grid
			)
			if (cover) {
				suppressor.coverSourceId = cover.sourceId
				suppressor.coverTarget = cover.position
				movement = cover.position.sub(suppressor.pos).unit()
			} else {
				suppressor.coverTimer = 2.5
			}
		}
		const movementDirection = movement.len() > 0.001
			? movement.unit()
			: k.vec2(0)
		const desiredDirection = getEnemyNavigationDirection(
			suppressor,
			movementDirection,
			suppressor.coverTarget ?? playerObj.pos
		)
		suppressor.moveDirection = easeDirection(suppressor.moveDirection, desiredDirection, 3.8, delta)
		if (movementDirection.len() > 0.001) {
			suppressor.move(suppressor.moveDirection.scale(70 * profile.speedMultiplier * velocityScale() * suppressor.getTimescale()))
		}
		suppressor.facingDirection = easeDirection(suppressor.facingDirection, direction, 6, delta)
		suppressor.angle = suppressor.facingDirection.angle() + 90
		applyDirectionalSteeringLean(
			suppressor,
			suppressor.facingDirection,
			direction,
			profile.scale
		)
		suppressor.fireTimer -= delta * (suppressor.shieldFireRateMultiplier ?? 1)
		if (
			suppressor.fireTimer <= 0 &&
			distance < 470 &&
			hasEnemyLineOfSight(suppressor, playerObj.pos)
		) {
			fireSuppressorFan(suppressor, direction, profile.elite && suppressor.wideFan)
			suppressor.wideFan = !suppressor.wideFan
			suppressor.fireTimer = profile.elite ? 1.45 : 1.85
		}
		handleEnemyCombat(suppressor, "SUPPRESSOR", "enemy_suppressor")
	})
	return suppressor
}

function fireSuppressorFan(suppressor: Suppressor, direction: Vec2, wide: boolean) {
	const angles = wide ? [-28, -14, 0, 14, 28] : [-12, 0, 12]
	for (const offset of angles) {
		const shotDirection = k.Vec2.fromAngle(direction.angle() + offset)
		const shot = spawnEnemyBlaster(
			suppressor.pos.clone(), shotDirection, shotDirection.angle() + 90, suppressor.damage,
			{ name: "SUPPRESSOR", sprite: "enemy_suppressor" },
			suppressor
		)
		if (!shot) continue
		shot.speed *= wide ? 0.48 : 0.62
		shot.playerStatusEffect = {
			id: "suppressed",
			sourceId: suppressor.id,
			stat: "weaponRecovery",
			multiplier: wide ? 1.28 : 1.4,
			duration: wide ? 1.8 : 2.4,
		}
	}
}
