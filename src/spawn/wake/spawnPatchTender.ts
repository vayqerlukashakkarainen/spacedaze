import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getEnemyNavigationDirection } from "../../services/enemyNavigationService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const PATCH_TENDER_VISUAL = getEnemyVisual("wake-patch-tender")

export function spawnPatchTender(
	pos: Vec2,
	hp = 4,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, PATCH_TENDER_VISUAL.worldScale, options)
	const [coreVisual, welderVisual] = PATCH_TENDER_VISUAL.parts
	const tender = k.add([
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
			hb: 10 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			repairTarget: undefined as GameObj | undefined,
			targetTimer: 0,
			healTimer: 0,
			draw() {
				if (welder.hidden || !this.repairTarget?.exists()) return
				k.drawLine({
					p1: k.vec2(),
					p2: this.repairTarget.pos.sub(this.pos),
					width: 1,
					color: k.WHITE,
					opacity: k.wave(0.25, 0.7, k.time() * 6),
				})
			},
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleSupport,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const welder = addWakeEnemyPart(
		tender,
		welderVisual.sprite,
		Math.max(1, Math.round(profile.hp * 0.5))
	)
	composeWakeEnemy(tender, profile, [{
		obj: welder,
		hitbox: 5 * profile.scale,
		hitboxOffset: k.vec2(0, -9).scale(profile.scale),
	}], 6, 1.2)

	registerBatchedEntityUpdate("enemies", tender, () => {
		const delta = k.dt() * tender.getTimescale()
		tender.targetTimer -= delta
		if (
			welder.hidden ||
			tender.targetTimer <= 0 ||
			!tender.repairTarget?.exists()
		) {
			tender.repairTarget = welder.hidden ? undefined : findRepairTarget(tender)
			tender.targetTimer = 0.4
		}

		const fromPlayer = tender.pos.sub(playerObj.pos)
		let desired = fromPlayer.len() > 0 ? fromPlayer.unit() : k.vec2(0, 1)
		if (!welder.hidden && fromPlayer.len() > 165 && tender.repairTarget?.exists()) {
			const toTarget = tender.repairTarget.pos.sub(tender.pos)
			desired = toTarget.len() > 82 ? toTarget.unit() : toTarget.normal().unit()
		}
		const targetPos = tender.repairTarget?.exists()
			? tender.repairTarget.pos
			: tender.pos.add(desired.scale(200))
		desired = getEnemyNavigationDirection(tender, desired, targetPos)
		tender.moveDirection = easeDirection(tender.moveDirection, desired, 4.2, delta)
		tender.move(tender.moveDirection.scale(
			(welder.hidden ? 115 : 86) * profile.speedMultiplier * velocityScale() * tender.getTimescale()
		))
		tender.angle = tender.moveDirection.angle() + 90
		applyDirectionalSteeringLean(tender, tender.moveDirection, desired, profile.scale)

		tender.healTimer -= delta
		if (
			!welder.hidden &&
			tender.healTimer <= 0 &&
			tender.repairTarget?.exists() &&
			tender.pos.dist(tender.repairTarget.pos) < 135
		) {
			const target = tender.repairTarget
			target.hp = Math.min(
				target.maxHP,
				target.hp + (profile.elite ? 0.8 : 0.55)
			)
			tender.healTimer = profile.elite ? 0.48 : 0.72
		}
		handleWakeCompositeCombat(tender, "PATCH TENDER", "enemy_wake_patch_tender_core")
	})

	return tender
}

function findRepairTarget(tender: GameObj) {
	return (k.get(tags.enemy) as GameObj[])
		.filter((candidate) =>
			candidate !== tender &&
			candidate.exists() &&
			candidate.is(tags.unit) &&
			typeof candidate.hp === "number" &&
			typeof candidate.maxHP === "number" &&
			candidate.hp < candidate.maxHP &&
			candidate.pos.dist(tender.pos) < 300
		)
		.sort((a, b) => (a.hp / a.maxHP) - (b.hp / b.maxHP))[0]
}
