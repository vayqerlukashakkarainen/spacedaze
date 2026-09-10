import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { debrees, playerObj } from "../../game"
import { k, velocityScale } from "../../main"
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
	spawnDebreeValues,
	type DebreeSource,
	type DebreeValue,
} from "../spawnDebree"
import { spawnFlash } from "../spawnFlash"
import { spawnRivetGunner } from "./spawnRivetGunner"
import { spawnScrapNipper } from "./spawnScrapNipper"
import {
	addWakeEnemyPart,
	composeWakeEnemy,
	handleWakeCompositeCombat,
} from "./wakeEnemyShared"

type ScrapRaiserPhase = "forage" | "reconstruct" | "recover" | "exhausted"

type CollectibleEnemyDebree = GameObj & {
	salvageValue?: DebreeValue
	source?: DebreeSource
	collection?: unknown
	carriedBy?: number
	readyForPlayer?: boolean
}

const SCRAP_RAISER_VISUAL = getEnemyVisual("wake-scrap-raiser")
const RECONSTRUCTION_COST = 6
const RECONSTRUCTION_DURATION = 2
const RECONSTRUCTION_LIMIT = 2
const DEBREE_SEARCH_RADIUS = 440
const DEBREE_COLLECTION_RADIUS = 15

export function spawnScrapRaiser(
	pos: Vec2,
	hp = 5,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		SCRAP_RAISER_VISUAL.worldScale,
		options
	)
	const [coreVisual, leftCollectorVisual, rightCollectorVisual] = SCRAP_RAISER_VISUAL.parts
	const initialDirection = playerObj.pos.sub(pos)
	const raiser = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(initialDirection.len() > 0 ? initialDirection.angle() + 90 : 0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 11 * profile.scale,
			damage: profile.damage,
			phase: "forage" as ScrapRaiserPhase,
			phaseTimer: 0,
			targetTimer: 0,
			moveDirection: initialDirection.len() > 0
				? initialDirection.unit()
				: k.vec2(0, 1),
			targetDebree: undefined as CollectibleEnemyDebree | undefined,
			storedDebree: [] as DebreeValue[],
			storedValue: 0,
			reconstructions: 0,
			collectorCount: 2,
			draw() {
				drawStoredScrap(this)
			},
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleSupport,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const collectorHp = Math.max(1, Math.round(profile.hp * 0.4))
	const leftCollector = addWakeEnemyPart(
		raiser,
		leftCollectorVisual.sprite,
		collectorHp
	)
	const rightCollector = addWakeEnemyPart(
		raiser,
		rightCollectorVisual.sprite,
		collectorHp
	)
	composeWakeEnemy(raiser, profile, [
		{
			obj: leftCollector,
			hitbox: 6 * profile.scale,
			hitboxOffset: k.vec2(-8, 1).scale(profile.scale),
		},
		{
			obj: rightCollector,
			hitbox: 6 * profile.scale,
			hitboxOffset: k.vec2(8, 0).scale(profile.scale),
		},
	], 5, 1, () => {
		if (raiser.storedDebree.length === 0) return
		spawnDebreeValues(raiser.pos.clone(), [...raiser.storedDebree], {
			pattern: "radial",
			source: "enemy",
		})
	})

	registerBatchedEntityUpdate("enemies", raiser, () => {
		const delta = k.dt() * raiser.getTimescale()
		const collectorCount = Number(!leftCollector.hidden) + Number(!rightCollector.hidden)
		if (collectorCount !== raiser.collectorCount) {
			raiser.collectorCount = collectorCount
			if (collectorCount === 0) disableScrapRaiserCollectors(raiser)
		}
		raiser.phaseTimer += raiser.phase === "reconstruct" && collectorCount === 1
			? delta * 0.65
			: delta

		if (raiser.phase === "reconstruct") {
			raiser.opacity = k.wave(0.58, 1, k.time() * 9)
			if (raiser.phaseTimer >= RECONSTRUCTION_DURATION) {
				completeReconstruction(raiser, options)
			}
			handleWakeCompositeCombat(
				raiser,
				"SCRAP RAISER",
				"enemy_wake_scrap_raiser_core"
			)
			return
		}

		if (raiser.phase === "recover") {
			raiser.opacity = 1
			if (raiser.phaseTimer >= 0.8) {
				raiser.phase = raiser.reconstructions >= RECONSTRUCTION_LIMIT
					? "exhausted"
					: "forage"
				raiser.phaseTimer = 0
			}
		}

		updateScrapRaiserMovement(raiser, profile.speedMultiplier, delta)
		handleWakeCompositeCombat(
			raiser,
			"SCRAP RAISER",
			"enemy_wake_scrap_raiser_core"
		)
	})

	return raiser
}

function updateScrapRaiserMovement(
	raiser: GameObj,
	speedMultiplier: number,
	delta: number
) {
	raiser.targetTimer -= delta
	if (
		raiser.phase === "forage" &&
		(raiser.targetTimer <= 0 || !isCollectibleEnemyDebree(raiser.targetDebree))
	) {
		raiser.targetDebree = findNearestEnemyDebree(raiser.pos)
		raiser.targetTimer = 0.18
	}

	let targetPos: Vec2
	let speed = 76
	if (raiser.phase === "forage" && isCollectibleEnemyDebree(raiser.targetDebree)) {
		targetPos = raiser.targetDebree.pos
		speed = 108
	} else {
		const fromPlayer = raiser.pos.sub(playerObj.pos)
		const away = fromPlayer.len() > 0 ? fromPlayer.unit() : k.vec2(0, 1)
		const orbit = away.normal().scale(raiser.id % 2 === 0 ? 0.65 : -0.65)
		targetPos = raiser.pos.add(
			away.add(orbit).unit().scale(raiser.phase === "exhausted" ? 240 : 150)
		)
		speed = raiser.phase === "exhausted" ? 118 : 68
	}

	const toTarget = targetPos.sub(raiser.pos)
	if (toTarget.len() > 0.001) {
		const desired = getEnemyNavigationDirection(
			raiser,
			toTarget.unit(),
			targetPos
		)
		raiser.moveDirection = easeDirection(raiser.moveDirection, desired, 4.8, delta)
		raiser.move(raiser.moveDirection.scale(
			speed * speedMultiplier * velocityScale() * raiser.getTimescale()
		))
		raiser.angle = raiser.moveDirection.angle() + 90
	}

	if (
		raiser.phase === "forage" &&
		isCollectibleEnemyDebree(raiser.targetDebree) &&
		raiser.pos.dist(raiser.targetDebree.pos) <= DEBREE_COLLECTION_RADIUS
	) {
		collectDebree(raiser, raiser.targetDebree)
	}
}

function collectDebree(raiser: GameObj, debris: CollectibleEnemyDebree) {
	if (raiser.collectorCount === 0) return
	if (!isCollectibleEnemyDebree(debris)) return
	const value = debris.salvageValue ?? 1
	raiser.storedDebree.push(value)
	raiser.storedValue += value
	k.destroy(debris)
	raiser.targetDebree = undefined
	spawnFlash(raiser.pos.clone(), 4, k.rgb(70, 180, 255))
	if (raiser.storedValue < RECONSTRUCTION_COST) return
	raiser.phase = "reconstruct"
	raiser.phaseTimer = 0
}

function disableScrapRaiserCollectors(raiser: GameObj) {
	raiser.phase = "exhausted"
	raiser.phaseTimer = 0
	raiser.targetDebree = undefined
	raiser.opacity = 1
	if (raiser.storedDebree.length === 0) return
	spawnDebreeValues(raiser.pos.clone(), [...raiser.storedDebree], {
		pattern: "radial",
		source: "enemy",
	})
	raiser.storedDebree.length = 0
	raiser.storedValue = 0
}

function completeReconstruction(raiser: GameObj, options: EnemySpawnOptions) {
	if (!raiser.exists()) return
	const fromPlayer = raiser.pos.sub(playerObj.pos)
	const direction = fromPlayer.len() > 0 ? fromPlayer.unit() : k.vec2(0, -1)
	const spawnPos = raiser.pos.add(direction.scale(28))
	const summonOptions: EnemySpawnOptions = {
		persistOffscreen: options.persistOffscreen,
		elite: false,
		rewardMode: "reconstructed",
		tags: [...new Set([tags.reconstructedEnemy, ...(options.tags ?? [])])],
	}
	if (k.chance(0.7)) {
		spawnScrapNipper(spawnPos, 2, summonOptions)
	} else {
		spawnRivetGunner(spawnPos, 5, summonOptions)
	}
	spawnFlash(spawnPos, 10, k.rgb(70, 180, 255))
	raiser.storedDebree.length = 0
	raiser.storedValue = 0
	raiser.reconstructions++
	raiser.phase = "recover"
	raiser.phaseTimer = 0
	raiser.opacity = 1
}

function findNearestEnemyDebree(pos: Vec2) {
	let nearest: CollectibleEnemyDebree | undefined
	let nearestDistance = DEBREE_SEARCH_RADIUS
	for (const candidate of debrees as CollectibleEnemyDebree[]) {
		if (!isCollectibleEnemyDebree(candidate)) continue
		const distance = candidate.pos.dist(pos)
		if (distance >= nearestDistance) continue
		nearest = candidate
		nearestDistance = distance
	}
	return nearest
}

function isCollectibleEnemyDebree(
	debris: CollectibleEnemyDebree | undefined
): debris is CollectibleEnemyDebree {
	return debris !== undefined &&
		debris.exists() &&
		debris.source === "enemy" &&
		debris.collection === undefined &&
		debris.carriedBy === undefined &&
		debris.readyForPlayer !== true &&
		!debris.is(tags.stressDebree)
}

function drawStoredScrap(raiser: GameObj) {
	const visiblePieces = Math.min(6, raiser.storedDebree.length)
	const reconstructing = raiser.phase === "reconstruct"
	const progress = reconstructing
		? k.clamp(raiser.phaseTimer / RECONSTRUCTION_DURATION, 0, 1)
		: 0
	const radius = reconstructing ? k.lerp(18, 8, progress) : 15
	for (let index = 0; index < visiblePieces; index++) {
		const angle = index / Math.max(1, visiblePieces) * 360 + k.time() * 95
		const offset = k.Vec2.fromAngle(angle).scale(radius / raiser.scale.x)
		k.drawRect({
			pos: offset,
			width: 2 / raiser.scale.x,
			height: 2 / raiser.scale.x,
			anchor: "center",
			color: index % 2 === 0 ? k.WHITE : k.rgb(70, 180, 255),
			opacity: reconstructing ? k.lerp(0.55, 1, progress) : 0.72,
		})
	}
	if (!reconstructing) return
	k.drawCircle({
		radius: k.lerp(19, 9, progress) / raiser.scale.x,
		fill: false,
		outline: {
			width: 1 / raiser.scale.x,
			color: k.rgb(70, 180, 255),
			opacity: k.wave(0.3, 0.82, k.time() * 7),
		},
		anchor: "center",
	})
}
