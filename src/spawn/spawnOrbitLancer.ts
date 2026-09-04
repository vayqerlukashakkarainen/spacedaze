import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { spawnEnemyBlaster } from "../services/projectileHelpers"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

export function spawnOrbitLancer(
	pos: Vec2,
	hp = 3,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.82, options)
	const lancer = k.add([
		k.pos(pos),
		k.sprite("enemy_orbit_lancer"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 12 * profile.scale,
			damage: profile.damage,
			orbitDirection: k.chance(0.5) ? 1 : -1,
			moveDirection: k.vec2(0, 1),
			fireTimer: k.rand(0.4, 1.15),
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerEnemyLifecycle(lancer, profile, 4, 1)
	registerBatchedEntityUpdate("enemies", lancer, () => {
		const delta = k.dt() * lancer.getTimescale()
		const toPlayer = playerObj.pos.sub(lancer.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const tangent = direction.normal().scale(lancer.orbitDirection)
		const radial = distance < 175
			? direction.scale(-1.35)
			: distance > 245
				? direction.scale(1.1)
				: k.vec2(0)
		const desired = tangent.add(radial)
		if (desired.len() > 0) {
			lancer.moveDirection = easeDirection(
				lancer.moveDirection,
				desired.unit(),
				4.8,
				delta
			)
			lancer.move(lancer.moveDirection.scale(
				112 * profile.speedMultiplier * velocityScale() * lancer.getTimescale()
			))
			lancer.angle = lancer.moveDirection.angle() + 90
		}

		lancer.fireTimer -= delta * (lancer.shieldFireRateMultiplier ?? 1)
		if (lancer.fireTimer <= 0 && distance < 390) {
			const spread = profile.elite ? [-8, 0, 8] : [-5, 5]
			for (const angle of spread) {
				const shotDirection = k.Vec2.fromAngle(direction.angle() + angle)
				const shot = spawnEnemyBlaster(
					lancer.pos.clone(),
					shotDirection,
					shotDirection.angle() + 90,
					lancer.damage,
					{ name: "ORBIT LANCER", sprite: "enemy_orbit_lancer" }
				)
				shot.speed *= 0.82
			}
			lancer.fireTimer = profile.elite ? 1.15 : 1.5
		}
		handleEnemyCombat(lancer, "ORBIT LANCER", "enemy_orbit_lancer")
	})

	return lancer
}
