import type { GameObj, Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"

export function spawnRepairSkiff(
	pos: Vec2,
	hp = 3,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 0.72, options)
	const skiff = k.add([
		k.pos(pos),
		k.sprite("enemy_repair_skiff"),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 10 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			repairTarget: undefined as GameObj | undefined,
			targetTimer: 0,
			healTimer: 0,
			draw() {
				if (!this.repairTarget?.exists()) return
				k.drawLine({
					p1: k.vec2(),
					p2: this.repairTarget.pos.sub(this.pos),
					width: 1,
					color: k.WHITE,
					opacity: k.wave(0.2, 0.65, k.time() * 5),
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

	registerEnemyLifecycle(skiff, profile, 5, 1.2)
	registerBatchedEntityUpdate("enemies", skiff, () => {
		const delta = k.dt() * skiff.getTimescale()
		skiff.targetTimer -= delta
		if (skiff.targetTimer <= 0 || !skiff.repairTarget?.exists()) {
			skiff.repairTarget = findRepairTarget(skiff)
			skiff.targetTimer = 0.45
		}

		const fromPlayer = skiff.pos.sub(playerObj.pos)
		let desired = fromPlayer.len() > 0 ? fromPlayer.unit() : k.vec2(0, 1)
		if (fromPlayer.len() > 175 && skiff.repairTarget?.exists()) {
			const toTarget = skiff.repairTarget.pos.sub(skiff.pos)
			if (toTarget.len() > 78) desired = toTarget.unit()
			else desired = toTarget.normal().unit()
		}
		skiff.moveDirection = easeDirection(skiff.moveDirection, desired, 4.4, delta)
		skiff.move(skiff.moveDirection.scale(
			98 * profile.speedMultiplier * velocityScale() * skiff.getTimescale()
		))
		skiff.angle = skiff.moveDirection.angle() + 90

		skiff.healTimer -= delta
		if (
			skiff.healTimer <= 0 &&
			skiff.repairTarget?.exists() &&
			skiff.pos.dist(skiff.repairTarget.pos) < 130
		) {
			const currentHp = skiff.repairTarget.hp()
			const maxHp = skiff.repairTarget.maxHP()
			skiff.repairTarget.setHP(Math.min(maxHp, currentHp + (profile.elite ? 1 : 0.65)))
			skiff.healTimer = profile.elite ? 0.48 : 0.7
		}
		handleEnemyCombat(skiff, "REPAIR SKIFF", "enemy_repair_skiff")
	})

	return skiff
}

function findRepairTarget(skiff: GameObj) {
	return (k.get(tags.enemy) as GameObj[])
		.filter((candidate) =>
			candidate !== skiff &&
			candidate.exists() &&
			candidate.is(tags.unit) &&
			typeof candidate.hp === "function" &&
			typeof candidate.maxHP === "function" &&
			candidate.hp() < candidate.maxHP() &&
			candidate.pos.dist(skiff.pos) < 300
		)
		.sort((a, b) =>
			(a.hp() / a.maxHP()) - (b.hp() / b.maxHP())
		)[0]
}
