import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
} from "../services/enemyNavigationService"
import { clearPlayerStatusEffectsFromSource } from "../services/playerStatusEffectService"
import { spawnEnemyBlaster } from "../services/projectileHelpers"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

const SUPPRESSOR_VISUAL = getEnemyVisual("suppressor")

export function spawnSuppressor(pos: Vec2, hp = 6, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, SUPPRESSOR_VISUAL.worldScale, options)
	const suppressor = k.add([
		k.pos(pos), k.sprite(requirePrimaryVisualSprite(SUPPRESSOR_VISUAL)), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{ hb: 14 * profile.scale, damage: profile.damage, moveDirection: k.vec2(0, 1), facingDirection: k.vec2(0, 1), fireTimer: k.rand(0.7, 1.4), wideFan: false },
		tags.enemy, tags.unit, tags.enemyRoleController,
		...(profile.elite ? [tags.elite] : []), tags.gameLoop, ...(options.tags ?? []),
	])
	registerEnemyLifecycle(suppressor, profile, 7, 1.45)
	suppressor.onDestroy(() => clearPlayerStatusEffectsFromSource(suppressor.id))
	registerBatchedEntityUpdate("enemies", suppressor, () => {
		const delta = k.dt() * suppressor.getTimescale()
		const toPlayer = playerObj.pos.sub(suppressor.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const radial = distance < 220 ? direction.scale(-1) : distance > 330 ? direction : direction.normal().scale(0.55)
		const desiredDirection = getEnemyNavigationDirection(
			suppressor,
			radial.unit(),
			playerObj.pos
		)
		suppressor.moveDirection = easeDirection(suppressor.moveDirection, desiredDirection, 3.8, delta)
		suppressor.move(suppressor.moveDirection.scale(70 * profile.speedMultiplier * velocityScale() * suppressor.getTimescale()))
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

function fireSuppressorFan(suppressor: ReturnType<typeof k.add>, direction: Vec2, wide: boolean) {
	const angles = wide ? [-28, -14, 0, 14, 28] : [-12, 0, 12]
	for (const offset of angles) {
		const shotDirection = k.Vec2.fromAngle(direction.angle() + offset)
		const shot = spawnEnemyBlaster(
			suppressor.pos.clone(), shotDirection, shotDirection.angle() + 90, suppressor.damage,
			{ name: "SUPPRESSOR", sprite: "enemy_suppressor" }
		)
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
