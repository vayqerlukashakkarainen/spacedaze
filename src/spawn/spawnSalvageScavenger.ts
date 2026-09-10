import type { GameObj, Vec2 } from "kaplay"
import { debrees, playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { getEnemyNavigationDirection } from "../services/enemies/enemyNavigationService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/enemies/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { snareable } from "../comp/snareable"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnDebree } from "./spawnDebree"

const SALVAGE_SCAVENGER_VISUAL = getEnemyVisual("salvage-scavenger")

export function spawnSalvageScavenger(pos: Vec2, hp = 4, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, SALVAGE_SCAVENGER_VISUAL.worldScale, options)
	const scavenger = k.add([
		k.pos(pos), k.sprite(requirePrimaryVisualSprite(SALVAGE_SCAVENGER_VISUAL)), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
		snareable({ mass: 0.6, radius: 11 * profile.scale, releaseDrag: 1.35, suspendTimescaleWhileMoving: true, canSnare: () => !profile.elite }),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{ hb: 11 * profile.scale, damage: profile.damage, moveDirection: k.vec2(0, 1), haul: 0, targetDebris: undefined as GameObj | undefined, retreating: false },
		tags.enemy, tags.unit, tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []), tags.gameLoop, ...(options.tags ?? []),
	])
	registerEnemyLifecycle(scavenger, profile, 4, 1.1, () => {
		if (scavenger.haul > 0) spawnDebree(scavenger.pos, scavenger.haul + 2, { pattern: "radial" })
	})
	registerBatchedEntityUpdate("enemies", scavenger, () => {
		const delta = k.dt() * scavenger.getTimescale()
		if (!scavenger.targetDebris?.exists()) scavenger.targetDebris = findNearestDebris(scavenger.pos)
		if (scavenger.haul >= (profile.elite ? 7 : 5) || !scavenger.targetDebris) scavenger.retreating = true
		const retreatDirection = scavenger.pos.sub(playerObj.pos)
		const target = scavenger.retreating
			? scavenger.pos.add((retreatDirection.len() > 0 ? retreatDirection.unit() : k.vec2(0, -1)).scale(180))
			: scavenger.targetDebris!.pos
		const toTarget = target.sub(scavenger.pos)
		if (toTarget.len() > 0) {
			const desiredDirection = getEnemyNavigationDirection(
				scavenger,
				toTarget.unit(),
				target
			)
			scavenger.moveDirection = easeDirection(scavenger.moveDirection, desiredDirection, 6, delta)
			scavenger.move(scavenger.moveDirection.scale(125 * profile.speedMultiplier * velocityScale() * scavenger.getTimescale()))
			scavenger.angle = scavenger.moveDirection.angle() + 90
			applyDirectionalSteeringLean(
				scavenger,
				scavenger.moveDirection,
				desiredDirection,
				profile.scale
			)
		}
		if (!scavenger.retreating && scavenger.targetDebris?.exists() && scavenger.pos.dist(scavenger.targetDebris.pos) < 14) {
			scavenger.haul += scavenger.targetDebris.salvageValue ?? 1
			k.destroy(scavenger.targetDebris)
			scavenger.targetDebris = undefined
			if (profile.elite) scavenger.hp = Math.min(scavenger.maxHP, scavenger.hp + 0.5)
		}
		handleEnemyCombat(scavenger, "SALVAGE SCAVENGER", "enemy_salvage_scavenger")
	})
	return scavenger
}

function findNearestDebris(pos: Vec2) {
	return (debrees as GameObj[])
		.filter((debris) =>
			debris.exists() &&
			!debris.collection &&
			!debris.is(tags.stressDebree)
		)
		.sort((a, b) => a.pos.dist(pos) - b.pos.dist(pos))[0]
}
