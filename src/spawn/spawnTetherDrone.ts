import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import {
	clearEnemyMovementMultiplier,
	setEnemyMovementMultiplier,
} from "../services/enemyMovementModifierService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

const TETHER_RANGE = 230

export function spawnTetherDrone(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.78, options)
	const drone = k.add([
		k.pos(pos),
		k.sprite("enemy_tether_drone"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 11 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			tetherActive: false,
			draw() {
				if (!this.tetherActive || !playerObj.exists()) return
				k.drawLine({
					p1: k.vec2(),
					p2: playerObj.pos.sub(this.pos),
					width: 1,
					color: k.WHITE,
					opacity: k.wave(0.28, 0.8, k.time() * 7),
				})
			},
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleController,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerEnemyLifecycle(drone, profile, 5, 1.15)
	drone.onDestroy(() => clearEnemyMovementMultiplier(drone.id))
	registerBatchedEntityUpdate("enemies", drone, () => {
		const delta = k.dt() * drone.getTimescale()
		const toPlayer = playerObj.pos.sub(drone.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const radial = distance < 125
			? direction.scale(-1)
			: distance > 190
				? direction
				: direction.normal().scale(0.45)
		drone.moveDirection = easeDirection(
			drone.moveDirection,
			radial.unit(),
			4,
			delta
		)
		drone.move(drone.moveDirection.scale(
			82 * profile.speedMultiplier * velocityScale() * drone.getTimescale()
		))
		drone.angle = drone.moveDirection.angle() + 90
		drone.tetherActive = distance <= TETHER_RANGE
		if (drone.tetherActive) {
			setEnemyMovementMultiplier(drone.id, profile.elite ? 0.58 : 0.72)
		} else {
			clearEnemyMovementMultiplier(drone.id)
		}
		handleEnemyCombat(drone, "TETHER DRONE", "enemy_tether_drone")
	})

	return drone
}
