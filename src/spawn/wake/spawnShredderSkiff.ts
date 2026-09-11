import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, velocityScale } from "../../main"
import { applyDamage } from "../../services/combat/damageService"
import { spawnProjectile } from "../../services/combat/projectileService"
import { triggerShipPartExplosion } from "../../services/combat/shipPartDamageService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getEnemyNavigationDirection } from "../../services/enemies/enemyNavigationService"
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
	updateWakeEnemyMalfunction,
} from "./wakeEnemyShared"

const SHREDDER_SKIFF_VISUAL = getEnemyVisual("wake-shredder-skiff")
const SHREDDER_APPROACH_DISTANCE = 54
const SHREDDER_APPROACH_SPEED = 82
const SHREDDER_DISABLED_SPEED = 108
const SHREDDER_HOPPER_EXPLOSION_RADIUS = 68
const SHREDDER_SCRAP_SEARCH_RADIUS = 560
const SHREDDER_GRIND_DURATION = 0.72
const SHREDDER_TELEGRAPH_DURATION = 0.78
const SHREDDER_RECOVERY_DURATION = 1.35

type ShredderPhase = "seek" | "grind" | "telegraph" | "recover" | "disabled"

export function spawnShredderSkiff(
	pos: Vec2,
	hp = 8,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		SHREDDER_SKIFF_VISUAL.worldScale,
		options
	)
	const [coreVisual, grinderVisual, hopperVisual] = SHREDDER_SKIFF_VISUAL.parts
	const toPlayer = playerObj.pos.sub(pos)
	const initialDirection = toPlayer.len() > 0
		? toPlayer.unit()
		: k.vec2(0, -1)
	const skiff = k.add([
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
			hb: 14 * profile.scale,
			damage: profile.damage,
			grinderOperational: true,
			hopperOperational: true,
			hopperLoaded: false,
			phase: "seek" as ShredderPhase,
			phaseTimer: 0,
			searchTimer: 0,
			fallbackLoadTimer: 1.6,
			moveDirection: initialDirection,
			lockedDirection: initialDirection,
			scrapTarget: undefined as GameObj | undefined,
			draw() {
				if (this.phase !== "telegraph" || !this.hopperLoaded) return
				const length = 78 / this.scale.x
				const halfWidth = 36 / this.scale.y
				const opacity = k.wave(0.18, 0.62, k.time() * 10)
				k.drawLine({
					p1: k.vec2(0, -8),
					p2: k.vec2(-halfWidth, -length),
					width: 1,
					color: k.rgb(115, 220, 230),
					opacity,
				})
				k.drawLine({
					p1: k.vec2(0, -8),
					p2: k.vec2(halfWidth, -length),
					width: 1,
					color: k.rgb(115, 220, 230),
					opacity,
				})
			},
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const grinder = addWakeEnemyPart(
		skiff,
		grinderVisual.sprite,
		2 * Math.max(3, Math.round(profile.hp / 2 * 0.48))
	)
	const hopper = addWakeEnemyPart(
		skiff,
		hopperVisual.sprite,
		2 * Math.max(3, Math.round(profile.hp / 2 * 0.58))
	)
	composeWakeEnemy(skiff, profile, [
		{
			obj: grinder,
			hitbox: 9 * profile.scale,
			hitboxOffset: k.vec2(0, -10).scale(profile.scale),
			pullForce: 90,
			pullDuration: 0.8,
			onDestroyed: () => disableGrinder(skiff),
		},
		{
			obj: hopper,
			hitbox: 8 * profile.scale,
			hitboxOffset: k.vec2(9, 1).scale(profile.scale),
			pullForce: 70,
			onDestroyed: (part) => destroyHopper(part, skiff),
		},
	], 10, 1.45)

	registerBatchedEntityUpdate("enemies", skiff, () => {
		const delta = k.dt() * skiff.getTimescale()
		if (updateWakeEnemyMalfunction(skiff, delta)) return
		skiff.phaseTimer += delta
		skiff.searchTimer -= delta
		skiff.fallbackLoadTimer -= delta
		const playerOffset = playerObj.pos.sub(skiff.pos)
		const distance = playerOffset.len()
		const playerDirection = distance > 0
			? playerOffset.unit()
			: skiff.moveDirection

		if (skiff.phase === "grind") {
			updateGrinding(skiff)
		} else if (skiff.phase === "telegraph") {
			updateTelegraph(skiff, profile, playerDirection)
		} else if (skiff.phase === "recover") {
			moveShredder(skiff, profile, playerDirection, distance, delta)
			if (skiff.phaseTimer >= SHREDDER_RECOVERY_DURATION) {
				skiff.phase = "seek"
				skiff.phaseTimer = 0
				skiff.fallbackLoadTimer = 1.6
			}
		} else if (skiff.phase === "disabled") {
			moveShredder(skiff, profile, playerDirection, distance, delta)
		} else {
			updateSeeking(skiff, profile, playerDirection, distance, delta)
		}
		if (!grinder.hidden) grinder.angle += 520 * delta

		handleWakeCompositeCombat(
			skiff,
			"SHREDDER SKIFF",
			"enemy_wake_shredder_skiff_core"
		)
	})
	skiff.onDestroy(() => releaseScrapTarget(skiff))

	return skiff
}

function updateSeeking(
	skiff: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	playerDirection: Vec2,
	distance: number,
	delta: number
) {
	if (!skiff.grinderOperational || !skiff.hopperOperational) {
		skiff.phase = "disabled"
		skiff.phaseTimer = 0
		moveShredder(skiff, profile, playerDirection, distance, delta)
		return
	}
	if (
		skiff.searchTimer <= 0 ||
		!skiff.scrapTarget?.exists() ||
		skiff.scrapTarget.shredderClaimedBy !== skiff.id
	) {
		releaseScrapTarget(skiff)
		skiff.scrapTarget = findScrapTarget(skiff)
		if (skiff.scrapTarget) skiff.scrapTarget.shredderClaimedBy = skiff.id
		skiff.searchTimer = 0.4
	}

	if (skiff.scrapTarget?.exists()) {
		const offset = skiff.scrapTarget.pos.sub(skiff.pos)
		const direction = offset.len() > 0 ? offset.unit() : skiff.moveDirection
		if (offset.len() <= 30 * profile.scale) {
			skiff.phase = "grind"
			skiff.phaseTimer = 0
			return
		}
		moveToward(skiff, profile, direction, skiff.scrapTarget.pos, delta)
		return
	}

	moveShredder(skiff, profile, playerDirection, distance, delta)
	if (skiff.fallbackLoadTimer <= 0) beginTelegraph(skiff, playerDirection)
}

function updateGrinding(skiff: any) {
	const target = skiff.scrapTarget as GameObj | undefined
	if (!skiff.grinderOperational || !skiff.hopperOperational) {
		releaseScrapTarget(skiff)
		skiff.phase = "disabled"
		skiff.phaseTimer = 0
		return
	}
	if (!target?.exists()) {
		releaseScrapTarget(skiff)
		skiff.phase = "seek"
		skiff.phaseTimer = 0
		return
	}
	const offset = target.pos.sub(skiff.pos)
	if (offset.len() > 0.001) skiff.angle = offset.angle() + 90
	skiff.opacity = k.wave(0.58, 1, k.time() * 16)
	if (skiff.phaseTimer < SHREDDER_GRIND_DURATION) return
	applyDamage(target, Math.max(1, target.hp + 1), {
		position: target.pos,
		showNumber: false,
	})
	releaseScrapTarget(skiff)
	skiff.opacity = 1
	skiff.hopperLoaded = true
	beginTelegraph(skiff, directionToPlayer(skiff))
}

function beginTelegraph(skiff: any, direction: Vec2) {
	skiff.hopperLoaded = true
	skiff.phase = "telegraph"
	skiff.phaseTimer = 0
	skiff.lockedDirection = direction.len() > 0 ? direction.unit() : k.vec2(0, -1)
}

function updateTelegraph(
	skiff: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	playerDirection: Vec2
) {
	if (!skiff.grinderOperational || !skiff.hopperOperational) {
		skiff.phase = "disabled"
		skiff.phaseTimer = 0
		return
	}
	skiff.lockedDirection = easeDirection(
		skiff.lockedDirection,
		playerDirection,
		2.7,
		k.dt() * skiff.getTimescale()
	)
	skiff.angle = skiff.lockedDirection.angle() + 90
	skiff.opacity = k.wave(0.72, 1, k.time() * 13)
	if (skiff.phaseTimer < SHREDDER_TELEGRAPH_DURATION) return
	fireFragmentCone(skiff, profile)
	skiff.hopperLoaded = false
	skiff.phase = "recover"
	skiff.phaseTimer = 0
	skiff.opacity = 1
}

function moveToward(
	skiff: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	direction: Vec2,
	target: Vec2,
	delta: number
) {
	const navigationDirection = getEnemyNavigationDirection(skiff, direction, target)
	skiff.moveDirection = easeDirection(
		skiff.moveDirection,
		navigationDirection,
		4.6,
		delta
	)
	skiff.move(skiff.moveDirection.scale(
		SHREDDER_APPROACH_SPEED * profile.speedMultiplier *
			velocityScale() * skiff.getTimescale()
	))
	skiff.angle = skiff.moveDirection.angle() + 90
}

function moveShredder(
	skiff: any,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	playerDirection: Vec2,
	distance: number,
	delta: number
) {
	const desiredDirection = getShredderDirection(skiff, playerDirection, distance)
	const destination = skiff.grinderOperational
		? playerObj.pos
		: skiff.pos.add(desiredDirection.scale(180))
	const navigationDirection = getEnemyNavigationDirection(
		skiff,
		desiredDirection,
		destination
	)
	skiff.moveDirection = easeDirection(
		skiff.moveDirection,
		navigationDirection,
		skiff.grinderOperational ? 4.2 : 5.6,
		delta
	)
	const speed = skiff.grinderOperational
		? SHREDDER_APPROACH_SPEED
		: SHREDDER_DISABLED_SPEED
	skiff.move(skiff.moveDirection.scale(
		speed * profile.speedMultiplier * velocityScale() * skiff.getTimescale()
	))
	skiff.angle = skiff.moveDirection.angle() + 90
}

function findScrapTarget(skiff: GameObj) {
	return (k.get(tags.roomCover) as GameObj[])
		.filter((target) =>
			target.exists() &&
			typeof target.hp === "number" &&
			target.hp > 0 &&
			target.exploding !== true &&
			(target.shredderClaimedBy === undefined ||
				target.shredderClaimedBy === skiff.id) &&
			target.pos.dist(skiff.pos) <= SHREDDER_SCRAP_SEARCH_RADIUS
		)
		.sort((a, b) => a.pos.dist(skiff.pos) - b.pos.dist(skiff.pos))[0]
}

function releaseScrapTarget(skiff: any) {
	const target = skiff.scrapTarget as GameObj | undefined
	if (target?.exists() && target.shredderClaimedBy === skiff.id) {
		target.shredderClaimedBy = undefined
	}
	skiff.scrapTarget = undefined
}

function directionToPlayer(skiff: GameObj) {
	const offset = playerObj.pos.sub(skiff.pos)
	return offset.len() > 0 ? offset.unit() : k.vec2(0, -1)
}

function fireFragmentCone(
	skiff: any,
	profile: ReturnType<typeof createEnemySpawnProfile>
) {
	const count = profile.elite ? 9 : 7
	for (let index = 0; index < count; index++) {
		const spread = k.lerp(-24, 24, index / (count - 1))
		const direction = skiff.lockedDirection.rotate(spread)
		spawnProjectile({
			pos: skiff.pos.add(direction.scale(15 * profile.scale)),
			dir: direction,
			rotation: direction.angle() + 90,
			sprite: "particle3",
			visualScale: k.rand(0.75, 1.2),
			speed: k.rand(270, 330),
			tags: [tags.enemy, tags.blaster],
			damageSource: {
				name: profile.elite ? "ELITE SHREDDER SKIFF" : "SHREDDER SKIFF",
				sprite: "enemy_wake_shredder_skiff_core",
			},
			impact: { damage: skiff.damage * 0.52 },
			lifespan: { duration: 1.6 },
			fireSound: index === 0 ? "shoot1" : undefined,
			fireSoundVolume: 0.65,
		})
	}
}

function getShredderDirection(
	skiff: GameObj,
	playerDirection: Vec2,
	distance: number
) {
	if (skiff.grinderOperational) {
		if (distance > SHREDDER_APPROACH_DISTANCE) return playerDirection
		return playerDirection.normal().scale(skiff.id % 2 === 0 ? 1 : -1)
	}
	const tangent = playerDirection.normal().scale(skiff.id % 2 === 0 ? 0.55 : -0.55)
	return playerDirection.scale(-1).add(tangent).unit()
}

function disableGrinder(skiff: GameObj) {
	skiff.grinderOperational = false
	skiff.damage = 0
	releaseScrapTarget(skiff)
	skiff.phase = "disabled"
	skiff.phaseTimer = 0
}

function destroyHopper(part: GameObj, skiff: GameObj) {
	skiff.hopperOperational = false
	releaseScrapTarget(skiff)
	skiff.phase = "disabled"
	skiff.phaseTimer = 0
	if (!skiff.hopperLoaded) return
	skiff.hopperLoaded = false
	triggerShipPartExplosion(
		part,
		skiff,
		part.worldPos?.clone() ?? skiff.pos.clone(),
		{
			radius: SHREDDER_HOPPER_EXPLOSION_RADIUS,
			damage: Math.max(2, skiff.damage * 1.35),
			excludeIds: [skiff.id],
		}
	)
}
