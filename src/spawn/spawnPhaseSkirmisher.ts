import type { GameObj, PosComp, Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { applyDamage } from "../services/combat/damageService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { spawnLineTelegraph } from "../services/enemies/enemyTelegraphService"
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../services/enemies/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { snareable } from "../comp/snareable"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { isEnemyEmpDisrupted } from "../services/enemies/enemyEmpService"

const PHASE_SKIRMISHER_VISUAL = getEnemyVisual("phase-skirmisher")

type PhaseSkirmisher = GameObj<PosComp> & {
	blinking: boolean
	blinkTimer: number
	damage: number
}

export function spawnPhaseSkirmisher(pos: Vec2, hp = 5, options: EnemySpawnOptions = {}) {
	const profile = createEnemySpawnProfile(hp, 1, PHASE_SKIRMISHER_VISUAL.worldScale, options)
	const skirmisher = k.add([
		k.pos(pos), k.sprite(requirePrimaryVisualSprite(PHASE_SKIRMISHER_VISUAL)), k.color(k.WHITE), k.rotate(0),
		k.anchor("center"), k.health(profile.hp), k.animate(), k.scale(profile.scale), timescale(),
		snareable({ mass: 0.65, radius: 12 * profile.scale, releaseDrag: 1.3, suspendTimescaleWhileMoving: true, canSnare: () => !profile.elite && !skirmisher?.blinking }),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{ hb: 12 * profile.scale, damage: profile.damage, moveDirection: k.vec2(0, 1), blinkTimer: k.rand(1.2, 2.1), blinking: false },
		tags.enemy, tags.unit, tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []), tags.gameLoop, ...(options.tags ?? []),
	])
	registerEnemyLifecycle(skirmisher, profile, 6, 1.3)
	registerBatchedEntityUpdate("enemies", skirmisher, () => {
		const delta = k.dt() * skirmisher.getTimescale()
		const toPlayer = playerObj.pos.sub(skirmisher.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		if (!skirmisher.blinking) {
			const tangent = direction.normal().scale(Math.sin(k.time() * 2 + skirmisher.id))
			const desired = direction.scale(distance > 210 ? 1 : -0.3).add(tangent).unit()
			skirmisher.moveDirection = easeDirection(skirmisher.moveDirection, desired, 5, delta)
			skirmisher.move(skirmisher.moveDirection.scale(105 * profile.speedMultiplier * velocityScale() * skirmisher.getTimescale()))
			skirmisher.angle = skirmisher.moveDirection.angle() + 90
			applyDirectionalSteeringLean(
				skirmisher,
				skirmisher.moveDirection,
				desired,
				profile.scale
			)
			skirmisher.blinkTimer -= delta
			if (
				!isEnemyEmpDisrupted(skirmisher) &&
				skirmisher.blinkTimer <= 0 &&
				distance < 420
			) beginBlink(skirmisher, profile.elite, options.tags)
		}
		handleEnemyCombat(skirmisher, "PHASE SKIRMISHER", "enemy_phase_skirmisher")
	})
	return skirmisher
}

function beginBlink(skirmisher: PhaseSkirmisher, elite: boolean, extraTags?: string[]) {
	skirmisher.blinking = true
	const start = skirmisher.pos.clone()
	const toPlayer = playerObj.pos.sub(start)
	const direction = toPlayer.len() > 0 ? toPlayer.unit() : k.vec2(0, 1)
	const side = direction.normal().scale(k.chance(0.5) ? 1 : -1)
	const end = start.add(side.scale(105)).add(direction.scale(28))
	spawnLineTelegraph(start, end, {
		duration: elite ? 0.48 : 0.68,
		tags: extraTags,
		onComplete: () => {
			if (!skirmisher.exists()) return
			skirmisher.pos = end
			skirmisher.blinking = false
			skirmisher.blinkTimer = elite ? 1.25 : 1.8
			if (elite) spawnPhaseSeam(start, end, skirmisher.damage, extraTags)
		},
	})
}

function spawnPhaseSeam(start: Vec2, end: Vec2, damage: number, extraTags?: string[]) {
	const delta = end.sub(start)
	let hit = false
	const seam = k.add([
		k.pos(start), k.opacity(0.8), k.lifespan(0.8, { fade: 0.25 }),
		{ draw() { k.drawLine({ p1: k.vec2(), p2: delta, width: 3, color: k.WHITE, opacity: this.opacity }) } },
		tags.props, tags.gameLoop, ...(extraTags ?? []),
	])
	registerBatchedEntityUpdate("effects", seam, () => {
		if (hit || isPlayerDamageInvulnerable()) return
		const fromStart = playerObj.pos.sub(start)
		const lengthSquared = Math.max(1, delta.x * delta.x + delta.y * delta.y)
		const projection = k.clamp((fromStart.x * delta.x + fromStart.y * delta.y) / lengthSquared, 0, 1)
		const impactPosition = start.add(delta.scale(projection))
		if (playerObj.pos.dist(impactPosition) > 10) return
		hit = true
		applyDamage(playerObj, damage, {
			position: impactPosition,
			source: { name: "PHASE SEAM", sprite: "enemy_phase_skirmisher" },
		})
	})
}
