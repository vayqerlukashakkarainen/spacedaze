import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import {
	clearEnemyMovementMultiplier,
	setEnemyMovementMultiplier,
} from "../services/enemies/enemyMovementModifierService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
} from "../services/enemies/enemyNavigationService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/enemies/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { snareable } from "../comp/snareable"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { drawLightning } from "../services/combat/lightningVisualService"

const TETHER_RANGE = 230
const TETHER_DRONE_VISUAL = getEnemyVisual("tether-drone")

export function spawnTetherDrone(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, TETHER_DRONE_VISUAL.worldScale, options)
	const drone = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(TETHER_DRONE_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		snareable({
			mass: 0.55,
			radius: 11 * profile.scale,
			releaseDrag: 1.25,
			suspendTimescaleWhileMoving: true,
			canSnare: () => !profile.elite,
		}),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 11 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			tetherActive: false,
			draw() {
				if (!this.tetherActive || !playerObj.exists()) return
				const rotatedOffset = playerObj.pos.sub(this.pos).rotate(-this.angle)
				const localPlayerOffset = k.vec2(
					rotatedOffset.x / this.scale.x,
					rotatedOffset.y / this.scale.y
				)
				drawLightning({
					start: k.vec2(),
					end: localPlayerOffset,
					width: 1,
					color: k.WHITE,
					opacity: k.wave(0.28, 0.8, k.time() * 7),
					segmentLength: 13,
					amplitude: 4,
					waveCount: 1.25,
					smoothness: 0.82,
					flickerRate: 10,
					seed: this.id,
					branchChance: 0.03,
					branchLength: 7,
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
		const desiredDirection = getEnemyNavigationDirection(
			drone,
			radial.unit(),
			playerObj.pos
		)
		drone.moveDirection = easeDirection(
			drone.moveDirection,
			desiredDirection,
			4,
			delta
		)
		drone.move(drone.moveDirection.scale(
			82 * profile.speedMultiplier * velocityScale() * drone.getTimescale()
		))
		drone.angle = drone.moveDirection.angle() + 90
		applyDirectionalSteeringLean(
			drone,
			drone.moveDirection,
			desiredDirection,
			profile.scale
		)
		drone.tetherActive =
			distance <= TETHER_RANGE &&
			hasEnemyLineOfSight(drone, playerObj.pos)
		if (drone.tetherActive) {
			setEnemyMovementMultiplier(drone.id, profile.elite ? 0.58 : 0.72)
		} else {
			clearEnemyMovementMultiplier(drone.id)
		}
		handleEnemyCombat(drone, "TETHER DRONE", "enemy_tether_drone")
	})

	return drone
}
