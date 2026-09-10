import type { Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getEnemyNavigationDirection, hasEnemyLineOfSight } from "../../services/enemies/enemyNavigationService"
import { drawLightning } from "../../services/combat/lightningVisualService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/enemies/threatService"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const TOWHOOK_VISUAL = getEnemyVisual("wake-towhook-rig")
const TOWHOOK_RANGE = 245

export function spawnTowhookRig(
	pos: Vec2,
	hp = 6,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, TOWHOOK_VISUAL.worldScale, options)
	const [coreVisual, leftVisual, rightVisual] = TOWHOOK_VISUAL.parts
	const rig = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 11 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			tetherActive: false,
			hookCount: 2,
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
					opacity: k.wave(0.3, 0.78, k.time() * 7),
					segmentLength: 12,
					amplitude: 3,
					waveCount: 1.2,
					smoothness: 0.82,
					flickerRate: 10,
					seed: this.id,
					branchChance: 0.02,
					branchLength: 6,
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
	const partHp = Math.max(1, Math.round(profile.hp * 0.42))
	const leftHook = addWakeEnemyPart(rig, leftVisual.sprite, partHp)
	const rightHook = addWakeEnemyPart(rig, rightVisual.sprite, partHp)
	composeWakeEnemy(rig, profile, [
		{
			obj: leftHook,
			hitbox: 5 * profile.scale,
			hitboxOffset: k.vec2(-7, -8).scale(profile.scale),
		},
		{
			obj: rightHook,
			hitbox: 5 * profile.scale,
			hitboxOffset: k.vec2(7, -8).scale(profile.scale),
		},
	], 7, 1.25)

	registerBatchedEntityUpdate("enemies", rig, () => {
		const delta = k.dt() * rig.getTimescale()
		const toPlayer = playerObj.pos.sub(rig.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		rig.hookCount = Number(!leftHook.hidden) + Number(!rightHook.hidden)
		const desired = rig.hookCount === 0
			? direction
			: distance < 145
				? direction.scale(-1)
				: distance > 205
					? direction
					: direction.normal().scale(0.5)
		const navigationDirection = getEnemyNavigationDirection(
			rig,
			desired.unit(),
			playerObj.pos
		)
		rig.moveDirection = easeDirection(rig.moveDirection, navigationDirection, 3.8, delta)
		rig.move(rig.moveDirection.scale(
			(rig.hookCount === 0 ? 118 : 68) * profile.speedMultiplier * velocityScale() * rig.getTimescale()
		))
		rig.angle = direction.angle() + 90

		rig.tetherActive = rig.hookCount > 0 &&
			distance <= TOWHOOK_RANGE &&
			hasEnemyLineOfSight(rig, playerObj.pos)
		if (rig.tetherActive && distance > 55) {
			const pullDirection = rig.pos.sub(playerObj.pos).unit()
			const pullSpeed = (profile.elite ? 24 : 18) * rig.hookCount
			playerObj.move(pullDirection.scale(pullSpeed * velocityScale()))
		}
		handleWakeCompositeCombat(rig, "TOWHOOK RIG", "enemy_wake_towhook_rig_core")
	})

	return rig
}
