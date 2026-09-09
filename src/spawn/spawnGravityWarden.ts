import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { getEnemyNavigationDirection } from "../services/enemyNavigationService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnGravityPull } from "./spawnGravityPull"

const FIELD_RADIUS = 165
const GRAVITY_WARDEN_VISUAL = getEnemyVisual("gravity-warden")

export function spawnGravityWarden(
	pos: Vec2,
	hp = 6,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, GRAVITY_WARDEN_VISUAL.worldScale, options)
	const warden = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(GRAVITY_WARDEN_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 14 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			fieldTimer: k.rand(1.2, 2.2),
			fieldActive: 0,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleController,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const fieldRing = warden.add([
		k.circle(FIELD_RADIUS / profile.scale, { fill: false }),
		k.color(k.WHITE),
		k.opacity(0),
		k.anchor("center"),
	])
	const gravity = spawnGravityPull({
		pos: warden.pos.clone(),
		radius: 0,
		strength: 0,
		falloff: 0.65,
		targetTags: [tags.friendly],
		visualizePull: false,
		tags: options.tags,
	})

	registerEnemyLifecycle(warden, profile, 8, 1.6)
	warden.onDestroy(() => {
		if (gravity.exists()) k.destroy(gravity)
	})
	registerBatchedEntityUpdate("enemies", warden, () => {
		const delta = k.dt() * warden.getTimescale()
		const toPlayer = playerObj.pos.sub(warden.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const desired = distance < 185
			? direction.scale(-1)
			: distance > 275
				? direction
				: direction.normal()
		const desiredDirection = getEnemyNavigationDirection(
			warden,
			desired.unit(),
			playerObj.pos
		)
		warden.moveDirection = easeDirection(warden.moveDirection, desiredDirection, 3.4, delta)
		warden.move(warden.moveDirection.scale(
			64 * profile.speedMultiplier * velocityScale() * warden.getTimescale()
		))
		warden.angle = warden.moveDirection.angle() + 90
		applyDirectionalSteeringLean(
			warden,
			warden.moveDirection,
			desiredDirection,
			profile.scale,
			true
		)

		gravity.pos = warden.pos.clone()
		if (warden.fieldActive > 0) {
			warden.fieldActive -= delta
			gravity.radius = FIELD_RADIUS
			gravity.strength = profile.elite ? 230 : 175
			fieldRing.opacity = k.wave(0.18, 0.65, k.time() * 5)
			if (warden.fieldActive <= 0) warden.fieldTimer = profile.elite ? 1.5 : 2.1
		} else {
			warden.fieldTimer -= delta * (warden.shieldFireRateMultiplier ?? 1)
			gravity.radius = 0
			gravity.strength = 0
			fieldRing.opacity = 0
			if (warden.fieldTimer <= 0) {
				warden.fieldActive = profile.elite ? 2.1 : 1.55
			}
		}
		handleEnemyCombat(warden, "GRAVITY WARDEN", "enemy_gravity_warden")
	})

	return warden
}
