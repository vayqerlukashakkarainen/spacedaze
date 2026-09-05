import type { GameObj } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { setPerformanceCounter } from "./frameProfilerService"
import type { RunFrameContext } from "./runLoopService"
import { forEachSpatialNearby } from "./runtimeSpatialIndexService"

const SEPARATION_SEARCH_RADIUS = 72
const MAX_CANDIDATES_PER_ENEMY = 16
const MAX_NEIGHBORS_PER_ENEMY = 8
const MIN_SPACING = 20
const MAX_SPACING = 64
const EXTRA_SPACING = 4
const SEPARATION_RESPONSE = 15
const MAX_CORRECTION_PER_FRAME = 7

export function updateEnemySeparation(context: RunFrameContext) {
	if (!context.gameplayActive || context.paused || context.dt <= 0) return
	let correctedEnemies = 0
	let neighborChecks = 0
	const blend = 1 - Math.exp(-SEPARATION_RESPONSE * context.dt)

	for (const enemy of k.get(tags.enemy) as GameObj[]) {
		if (!canSeparate(enemy)) continue
		let correction = k.vec2(0)
		let candidateCount = 0
		let overlappingNeighbors = 0
		forEachSpatialNearby(
			enemy.pos,
			SEPARATION_SEARCH_RADIUS,
			{
				allTags: [tags.enemy, tags.unit],
				excludeIds: [enemy.id],
			},
			(neighbor) => {
				if (!canSeparate(neighbor)) return
				candidateCount++
				neighborChecks++
				const desiredSpacing = getDesiredSpacing(enemy, neighbor)
				const away = enemy.pos.sub(neighbor.pos)
				const distance = away.len()
				if (distance >= desiredSpacing) {
					if (candidateCount >= MAX_CANDIDATES_PER_ENEMY) return false
					return
				}
				const direction = distance > 0.001
					? away.scale(1 / distance)
					: getStableSeparationDirection(enemy.id, neighbor.id)
				correction = correction.add(
					direction.scale(desiredSpacing - distance)
				)
				overlappingNeighbors++
				if (
					overlappingNeighbors >= MAX_NEIGHBORS_PER_ENEMY ||
					candidateCount >= MAX_CANDIDATES_PER_ENEMY
				) return false
			}
		)
		if (overlappingNeighbors === 0) continue
		const mobility = getSeparationMobility(enemy)
		const offset = correction.scale(
			blend * mobility / overlappingNeighbors
		)
		const distance = offset.len()
		if (distance <= 0.001) continue
		enemy.pos = enemy.pos.add(
			distance > MAX_CORRECTION_PER_FRAME
				? offset.scale(MAX_CORRECTION_PER_FRAME / distance)
				: offset
		)
		correctedEnemies++
	}

	setPerformanceCounter("enemySeparationChecks", neighborChecks)
	setPerformanceCounter("enemySeparationCorrections", correctedEnemies)
}

function canSeparate(enemy: GameObj) {
	return enemy.exists() &&
		enemy.pos !== undefined &&
		!enemy.paused &&
		!enemy.is(tags.trainingTarget) &&
		enemy.separationDisabled !== true
}

function getDesiredSpacing(enemy: GameObj, neighbor: GameObj) {
	const combinedRadius = getSeparationRadius(enemy) + getSeparationRadius(neighbor)
	return k.clamp(
		combinedRadius + EXTRA_SPACING,
		MIN_SPACING,
		MAX_SPACING
	)
}

function getSeparationRadius(enemy: GameObj) {
	return typeof enemy.hb === "number" ? Math.max(6, enemy.hb) : 10
}

function getSeparationMobility(enemy: GameObj) {
	const radius = getSeparationRadius(enemy)
	return k.clamp(14 / radius, 0.18, 1)
}

function getStableSeparationDirection(enemyId: number, neighborId: number) {
	const angle = (enemyId * 137.5 + neighborId * 61.25) % 360
	return k.Vec2.fromAngle(angle)
}
