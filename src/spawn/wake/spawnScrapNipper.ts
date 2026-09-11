import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { snareable } from "../../comp/snareable"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getEnemyNavigationDirection, hasEnemyLineOfSight } from "../../services/enemies/enemyNavigationService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/enemies/threatService"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import {
	addWakeEnemyPart,
	composeWakeEnemy,
	handleWakeCompositeCombat,
	updateWakeEnemyMalfunction,
} from "./wakeEnemyShared"

type NipperPhase = "approach" | "windup" | "lunge" | "recover"

const NIPPER_VISUAL = getEnemyVisual("wake-scrap-nipper")
const NIPPER_SNARE_MASS = 0.9

export function spawnScrapNipper(
	pos: Vec2,
	hp = 2,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, NIPPER_VISUAL.worldScale, options)
	const [coreVisual, leftCutterVisual, rightCutterVisual] = NIPPER_VISUAL.parts
	const initialDirection = playerObj.pos.sub(pos).unit()
	const nipper = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(initialDirection.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		snareable({
			mass: NIPPER_SNARE_MASS,
			radius: 9 * profile.scale,
			releaseDrag: 1.15,
			suspendTimescaleWhileMoving: true,
			canSnare: () => !profile.elite,
		}),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 8 * profile.scale,
			damage: profile.damage,
			cutterCount: 2,
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
	const cutterHp = 2 * Math.max(1, Math.round(profile.hp / 2 * 0.5))
	const leftCutter = addWakeEnemyPart(
		nipper,
		leftCutterVisual.sprite,
		cutterHp
	)
	const rightCutter = addWakeEnemyPart(
		nipper,
		rightCutterVisual.sprite,
		cutterHp
	)
	composeWakeEnemy(nipper, profile, [
		{
			obj: leftCutter,
			hitbox: 5 * profile.scale,
			hitboxOffset: k.vec2(-6, -8).scale(profile.scale),
			pullForce: 55,
			pullDuration: 0.45,
			onDestroyed: () => handleCutterDestroyed(nipper, profile),
		},
		{
			obj: rightCutter,
			hitbox: 5 * profile.scale,
			hitboxOffset: k.vec2(6, -8).scale(profile.scale),
			pullForce: 55,
			pullDuration: 0.45,
			onDestroyed: () => handleCutterDestroyed(nipper, profile),
		},
	], 2, 0.7)

	registerBatchedEntityUpdate("enemies", nipper, () => {
		const delta = k.dt() * nipper.getTimescale()
		if (updateWakeEnemyMalfunction(nipper, delta)) return
		nipper.phaseTimer += delta
		const toPlayer = playerObj.pos.sub(nipper.pos)
		const distance = toPlayer.len()
		const playerDirection = distance > 0 ? toPlayer.unit() : nipper.moveDirection
		if (nipper.snared) {
			handleWakeCompositeCombat(
				nipper,
				"SCRAP NIPPER",
				"enemy_wake_scrap_nipper_core"
			)
			return
		}
		let speed = 90

		if (nipper.phase === "approach") {
			const desiredDirection = nipper.cutterCount === 0
				? playerDirection.scale(-1)
				: playerDirection
			const desired = getEnemyNavigationDirection(
				nipper,
				desiredDirection,
				nipper.cutterCount === 0
					? nipper.pos.add(desiredDirection.scale(200))
					: playerObj.pos
			)
			nipper.moveDirection = easeDirection(nipper.moveDirection, desired, 6, delta)
			if (
				nipper.cutterCount > 0 &&
				(distance < 165 || nipper.phaseTimer > 1.6) &&
				hasEnemyLineOfSight(nipper, playerObj.pos)
			) {
				nipper.phase = "windup"
				nipper.phaseTimer = 0
				nipper.lockedDirection = playerDirection
			}
		} else if (nipper.phase === "windup") {
			if (nipper.cutterCount === 0) {
				nipper.phase = "recover"
				nipper.phaseTimer = 0
				nipper.opacity = 1
				speed = 28
			} else {
				speed = 0
				nipper.moveDirection = nipper.lockedDirection
				nipper.opacity = k.wave(0.3, 1, k.time() * 16)
				const windupDuration = profile.elite
					? 0.28
					: nipper.cutterCount === 1
						? 0.52
						: 0.42
				if (nipper.phaseTimer >= windupDuration) {
					nipper.phase = "lunge"
					nipper.phaseTimer = 0
					nipper.opacity = 1
				}
			}
		} else if (nipper.phase === "lunge") {
			if (nipper.cutterCount === 0) {
				nipper.phase = "recover"
				nipper.phaseTimer = 0
				speed = 28
			} else {
				nipper.moveDirection = nipper.lockedDirection
				speed = nipper.cutterCount === 1
					? (profile.elite ? 250 : 215)
					: (profile.elite ? 360 : 310)
				if (nipper.phaseTimer >= 0.52) {
					nipper.phase = "recover"
					nipper.phaseTimer = 0
				}
			}
		} else {
			speed = nipper.cutterCount === 0 ? 112 : 28
			if (nipper.phaseTimer >= 0.65) {
				nipper.phase = "approach"
				nipper.phaseTimer = 0
			}
		}

		nipper.angle = nipper.moveDirection.angle() + 90
		nipper.move(nipper.moveDirection.scale(
			speed * profile.speedMultiplier * velocityScale() * nipper.getTimescale()
		))
		handleWakeCompositeCombat(
			nipper,
			"SCRAP NIPPER",
			"enemy_wake_scrap_nipper_core"
		)
	})

	return nipper
}

function handleCutterDestroyed(
	nipper: GameObj,
	profile: ReturnType<typeof createEnemySpawnProfile>
) {
	nipper.cutterCount = Math.max(0, nipper.cutterCount - 1)
	nipper.damage = profile.damage * (nipper.cutterCount === 1 ? 0.6 : 0.25)
}
