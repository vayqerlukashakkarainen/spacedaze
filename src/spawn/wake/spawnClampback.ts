import type { Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { spawnEnemyBlaster } from "../../services/combat/projectileHelpers"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
} from "../../services/enemies/enemyNavigationService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../../services/enemies/threatService"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import {
	addWakeEnemyPart,
	composeWakeEnemy,
	handleWakeCompositeCombat,
} from "./wakeEnemyShared"

type ClampbackPhase = "advance" | "windup" | "recover"

const CLAMPBACK_VISUAL = getEnemyVisual("wake-clampback")
const CLAMPBACK_ATTACK_RANGE = 245
const CLAMPBACK_WINDUP = 0.62

export function spawnClampback(
	pos: Vec2,
	hp = 7,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		CLAMPBACK_VISUAL.worldScale,
		options
	)
	const [coreVisual, leftClampVisual, rightClampVisual] = CLAMPBACK_VISUAL.parts
	const toPlayer = playerObj.pos.sub(pos)
	const initialDirection = toPlayer.len() > 0
		? toPlayer.unit()
		: k.vec2(0, -1)
	const clampback = k.add([
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
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 13 * profile.scale,
			damage: profile.damage,
			phase: "advance" as ClampbackPhase,
			phaseTimer: 0,
			attackCooldown: k.rand(0.4, 1),
			clampCount: 2,
			moveDirection: initialDirection,
			lockedDirection: initialDirection,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const clampHp = Math.max(2, Math.round(profile.hp * 0.48))
	const leftClamp = addWakeEnemyPart(
		clampback,
		leftClampVisual.sprite,
		clampHp
	)
	const rightClamp = addWakeEnemyPart(
		clampback,
		rightClampVisual.sprite,
		clampHp
	)
	composeWakeEnemy(clampback, profile, [
		{
			obj: leftClamp,
			hitbox: 7 * profile.scale,
			hitboxOffset: k.vec2(-10, 1).scale(profile.scale),
			onDestroyed: () => handleClampDestroyed(clampback),
		},
		{
			obj: rightClamp,
			hitbox: 7 * profile.scale,
			hitboxOffset: k.vec2(10, 1).scale(profile.scale),
			onDestroyed: () => handleClampDestroyed(clampback),
		},
	], 8, 1.35)

	registerBatchedEntityUpdate("enemies", clampback, () => {
		const delta = k.dt() * clampback.getTimescale()
		const playerOffset = playerObj.pos.sub(clampback.pos)
		const distance = playerOffset.len()
		const playerDirection = distance > 0
			? playerOffset.unit()
			: clampback.moveDirection
		clampback.phaseTimer += delta
		clampback.attackCooldown -= delta * (
			clampback.clampCount === 0 ? 1.45 : 1
		)

		if (clampback.phase === "windup") {
			const progress = k.clamp(
				clampback.phaseTimer / CLAMPBACK_WINDUP,
				0,
				1
			)
			leftClamp.angle = leftClamp.hidden ? 0 : -12 * progress
			rightClamp.angle = rightClamp.hidden ? 0 : 12 * progress
			clampback.opacity = k.wave(0.62, 1, k.time() * 12)
			clampback.angle = clampback.lockedDirection.angle() + 90
			if (clampback.phaseTimer >= CLAMPBACK_WINDUP) {
				fireClampbackVolley(clampback, profile)
				clampback.phase = "recover"
				clampback.phaseTimer = 0
				clampback.opacity = 1
			}
		} else if (clampback.phase === "recover") {
			leftClamp.angle = k.lerp(leftClamp.angle, 0, 0.2)
			rightClamp.angle = k.lerp(rightClamp.angle, 0, 0.2)
			clampback.move(playerDirection.scale(
				-38 * profile.speedMultiplier * velocityScale() *
				clampback.getTimescale()
			))
			if (clampback.phaseTimer >= 0.48) {
				clampback.phase = "advance"
				clampback.phaseTimer = 0
			}
		} else {
			const tangent = playerDirection.normal().scale(
				clampback.id % 2 === 0 ? 0.45 : -0.45
			)
			const radial = distance > 150
				? playerDirection
				: distance < 95
					? playerDirection.scale(-1)
					: k.vec2(0)
			const desired = radial.add(tangent)
			const navigationDirection = getEnemyNavigationDirection(
				clampback,
				desired.len() > 0 ? desired.unit() : playerDirection,
				playerObj.pos
			)
			clampback.moveDirection = easeDirection(
				clampback.moveDirection,
				navigationDirection,
				3.4,
				delta
			)
			const exposedSpeedBonus = (2 - clampback.clampCount) * 18
			clampback.move(clampback.moveDirection.scale(
				(58 + exposedSpeedBonus) * profile.speedMultiplier *
				velocityScale() * clampback.getTimescale()
			))
			clampback.angle = playerDirection.angle() + 90
			if (
				clampback.attackCooldown <= 0 &&
				distance <= CLAMPBACK_ATTACK_RANGE &&
				hasEnemyLineOfSight(clampback, playerObj.pos)
			) {
				clampback.phase = "windup"
				clampback.phaseTimer = 0
				clampback.lockedDirection = playerDirection
			}
		}

		handleWakeCompositeCombat(
			clampback,
			"CLAMPBACK",
			"enemy_wake_clampback_core"
		)
	})

	return clampback
}

function handleClampDestroyed(clampback: any) {
	clampback.clampCount = Math.max(0, clampback.clampCount - 1)
	clampback.attackCooldown = Math.min(clampback.attackCooldown, 0.45)
}

function fireClampbackVolley(
	clampback: any,
	profile: ReturnType<typeof createEnemySpawnProfile>
) {
	const spreads = profile.elite
		? [-18, -9, 0, 9, 18]
		: [-11, 0, 11]
	for (const spread of spreads) {
		const direction = clampback.lockedDirection.rotate(spread)
		spawnEnemyBlaster(
			clampback.pos.add(direction.scale(14 * profile.scale)),
			direction,
			direction.angle() + 90,
			clampback.damage * 0.55,
			{
				name: profile.elite ? "ELITE CLAMPBACK" : "CLAMPBACK",
				sprite: "enemy_wake_clampback_core",
			},
			clampback
		)
	}
	clampback.attackCooldown = profile.elite ? 0.85 : 1.25
}
