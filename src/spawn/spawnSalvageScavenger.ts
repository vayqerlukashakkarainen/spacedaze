import type { GameObj, Vec2 } from "kaplay"
import { debrees, playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnDebree } from "./spawnDebree"

export function spawnSalvageScavenger(pos: Vec2, hp = 4, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, 0.76, options)
	const scavenger = k.add([
		k.pos(pos), k.sprite("enemy_salvage_scavenger"), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
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
			scavenger.moveDirection = easeDirection(scavenger.moveDirection, toTarget.unit(), 6, delta)
			scavenger.move(scavenger.moveDirection.scale(125 * profile.speedMultiplier * velocityScale() * scavenger.getTimescale()))
			scavenger.angle = scavenger.moveDirection.angle() + 90
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
		.filter((debris) => debris.exists() && !debris.collection)
		.sort((a, b) => a.pos.dist(pos) - b.pos.dist(pos))[0]
}
