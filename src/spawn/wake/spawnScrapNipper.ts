import type { Vec2 } from "kaplay"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getEnemyNavigationDirection, hasEnemyLineOfSight } from "../../services/enemyNavigationService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { handleEnemyCombat, registerEnemyLifecycle } from "../newEnemyShared"

type NipperPhase = "approach" | "windup" | "lunge" | "recover"

const NIPPER_VISUAL = getEnemyVisual("wake-scrap-nipper")

export function spawnScrapNipper(
	pos: Vec2,
	hp = 2,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, NIPPER_VISUAL.worldScale, options)
	const initialDirection = playerObj.pos.sub(pos).unit()
	const nipper = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(NIPPER_VISUAL)),
		k.color(k.WHITE),
		k.rotate(initialDirection.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 8 * profile.scale,
			damage: profile.damage,
			phase: "approach" as NipperPhase,
			phaseTimer: 0,
			moveDirection: initialDirection,
			lockedDirection: initialDirection,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleSwarm,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerEnemyLifecycle(nipper, profile, 2, 0.7)
	registerBatchedEntityUpdate("enemies", nipper, () => {
		const delta = k.dt() * nipper.getTimescale()
		nipper.phaseTimer += delta
		const toPlayer = playerObj.pos.sub(nipper.pos)
		const distance = toPlayer.len()
		const playerDirection = distance > 0 ? toPlayer.unit() : nipper.moveDirection
		let speed = 90

		if (nipper.phase === "approach") {
			const desired = getEnemyNavigationDirection(nipper, playerDirection, playerObj.pos)
			nipper.moveDirection = easeDirection(nipper.moveDirection, desired, 6, delta)
			if (
				(distance < 165 || nipper.phaseTimer > 1.6) &&
				hasEnemyLineOfSight(nipper, playerObj.pos)
			) {
				nipper.phase = "windup"
				nipper.phaseTimer = 0
				nipper.lockedDirection = playerDirection
			}
		} else if (nipper.phase === "windup") {
			speed = 0
			nipper.moveDirection = nipper.lockedDirection
			nipper.opacity = k.wave(0.3, 1, k.time() * 16)
			if (nipper.phaseTimer >= (profile.elite ? 0.28 : 0.42)) {
				nipper.phase = "lunge"
				nipper.phaseTimer = 0
				nipper.opacity = 1
			}
		} else if (nipper.phase === "lunge") {
			nipper.moveDirection = nipper.lockedDirection
			speed = profile.elite ? 360 : 310
			if (nipper.phaseTimer >= 0.52) {
				nipper.phase = "recover"
				nipper.phaseTimer = 0
			}
		} else {
			speed = 28
			if (nipper.phaseTimer >= 0.65) {
				nipper.phase = "approach"
				nipper.phaseTimer = 0
			}
		}

		nipper.angle = nipper.moveDirection.angle() + 90
		nipper.move(nipper.moveDirection.scale(
			speed * profile.speedMultiplier * velocityScale() * nipper.getTimescale()
		))
		applyDirectionalSteeringLean(
			nipper,
			nipper.moveDirection,
			playerDirection,
			profile.scale
		)
		handleEnemyCombat(nipper, "SCRAP NIPPER", "enemy_wake_scrap_nipper")
	})

	return nipper
}
