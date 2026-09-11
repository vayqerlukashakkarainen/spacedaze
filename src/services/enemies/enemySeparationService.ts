import type { GameObj } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"
import { setPerformanceCounter } from "../debug/frameProfilerService"
import type { RunFrameContext } from "../runs/runLoopService"
import {
	forEachSpatialNearby,
	getRuntimeEnemyUnits,
} from "../core/runtimeSpatialIndexService"

const SEPARATION_SEARCH_RADIUS = 72
const MAX_CANDIDATES_PER_ENEMY = 16
const MAX_NEIGHBORS_PER_ENEMY = 8
const MIN_SPACING = 14
const MAX_SPACING = 52
const SEPARATION_RADIUS_FACTOR = 0.8
const EXTRA_SPACING = 2
const SEPARATION_RESPONSE = 15
const MAX_CORRECTION_PER_FRAME = 7

const enemyIndices = new Map<number, number>()
const correctionX: number[] = []
const correctionY: number[] = []
const candidateCounts: number[] = []
const overlapCounts: number[] = []
let visitedPairs = new Uint32Array(0)
let visitedPairGeneration = 0
const separationQuery = { allTags: [tags.enemy, tags.unit] }
const SEPARATION_INTERVAL = 1 / 30
const CROWDED_SEPARATION_INTERVAL = 1 / 10
const CROWDED_ENEMY_THRESHOLD = 250
let separationElapsed = 0

export function updateEnemySeparation(context: RunFrameContext) {
	if (!context.gameplayActive || context.paused || context.dt <= 0) {
		separationElapsed = 0
		return
	}
	const enemies = getRuntimeEnemyUnits()
	const interval = enemies.length >= CROWDED_ENEMY_THRESHOLD
		? CROWDED_SEPARATION_INTERVAL
		: SEPARATION_INTERVAL
	separationElapsed += context.dt
	if (separationElapsed < interval) return
	const separationDelta = Math.min(separationElapsed, interval * 2)
	separationElapsed = 0
	prepareAccumulators(enemies)
	let correctedEnemies = 0
	let neighborChecks = 0
	const blend = 1 - Math.exp(-SEPARATION_RESPONSE * separationDelta)

	for (let firstIndex = 0; firstIndex < enemies.length; firstIndex++) {
		const first = enemies[firstIndex]
		if (!enemyIndices.has(first.id)) continue
		forEachSpatialNearby(
			first.pos,
			SEPARATION_SEARCH_RADIUS,
			separationQuery,
			(second) => {
				const secondIndex = enemyIndices.get(second.id)
				if (secondIndex === undefined || secondIndex === firstIndex) return
				candidateCounts[firstIndex]++
				const shouldStop =
					candidateCounts[firstIndex] >= MAX_CANDIDATES_PER_ENEMY ||
					overlapCounts[firstIndex] >= MAX_NEIGHBORS_PER_ENEMY
				const lowerIndex = Math.min(firstIndex, secondIndex)
				const upperIndex = Math.max(firstIndex, secondIndex)
				const pairIndex = upperIndex * (upperIndex - 1) / 2 + lowerIndex
				if (visitedPairs[pairIndex] === visitedPairGeneration) {
					return shouldStop ? false : undefined
				}
				visitedPairs[pairIndex] = visitedPairGeneration
				neighborChecks++
				if (overlapCounts[secondIndex] >= MAX_NEIGHBORS_PER_ENEMY) {
					return shouldStop ? false : undefined
				}

				accumulatePairCorrection(first, second, firstIndex, secondIndex)
				return shouldStop ? false : undefined
			}
		)
	}

	for (let index = 0; index < enemies.length; index++) {
		const enemy = enemies[index]
		const overlappingNeighbors = overlapCounts[index]
		if (overlappingNeighbors === 0) continue
		const mobility = getSeparationMobility(enemy)
		const scale = blend * mobility / overlappingNeighbors
		let offsetX = correctionX[index] * scale
		let offsetY = correctionY[index] * scale
		const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
		if (distance <= 0.001) continue
		if (distance > MAX_CORRECTION_PER_FRAME) {
			const clampScale = MAX_CORRECTION_PER_FRAME / distance
			offsetX *= clampScale
			offsetY *= clampScale
		}
		enemy.pos.x += offsetX
		enemy.pos.y += offsetY
		correctedEnemies++
	}

	setPerformanceCounter("enemySeparationChecks", neighborChecks)
	setPerformanceCounter("enemySeparationCorrections", correctedEnemies)
}

function prepareAccumulators(enemies: readonly GameObj[]) {
	enemyIndices.clear()
	correctionX.length = enemies.length
	correctionY.length = enemies.length
	candidateCounts.length = enemies.length
	overlapCounts.length = enemies.length
	correctionX.fill(0)
	correctionY.fill(0)
	candidateCounts.fill(0)
	overlapCounts.fill(0)
	visitedPairGeneration++
	if (visitedPairGeneration === 0xffffffff) {
		visitedPairs.fill(0)
		visitedPairGeneration = 1
	}
	const pairCapacity = enemies.length * (enemies.length - 1) / 2
	if (visitedPairs.length < pairCapacity) {
		visitedPairs = new Uint32Array(pairCapacity)
		visitedPairGeneration = 1
	}
	for (let index = 0; index < enemies.length; index++) {
		if (canSeparate(enemies[index])) enemyIndices.set(enemies[index].id, index)
	}
}

function accumulatePairCorrection(
	first: GameObj,
	second: GameObj,
	firstIndex: number,
	secondIndex: number
) {
	const desiredSpacing = getDesiredSpacing(first, second)
	const dx = first.pos.x - second.pos.x
	const dy = first.pos.y - second.pos.y
	const distanceSquared = dx * dx + dy * dy
	if (distanceSquared >= desiredSpacing * desiredSpacing) return
	const distance = Math.sqrt(distanceSquared)
	let directionX: number
	let directionY: number
	if (distance > 0.001) {
		directionX = dx / distance
		directionY = dy / distance
	} else {
		const direction = getStableSeparationDirection(first.id, second.id)
		directionX = direction.x
		directionY = direction.y
	}
	const overlap = desiredSpacing - distance
	const offsetX = directionX * overlap
	const offsetY = directionY * overlap
	correctionX[firstIndex] += offsetX
	correctionY[firstIndex] += offsetY
	correctionX[secondIndex] -= offsetX
	correctionY[secondIndex] -= offsetY
	overlapCounts[firstIndex]++
	overlapCounts[secondIndex]++
}

function canSeparate(enemy: GameObj) {
	return enemy.exists() &&
		enemy.pos !== undefined &&
		enemy.is(tags.enemy) &&
		enemy.is(tags.unit) &&
		!enemy.is(tags.projectile) &&
		!enemy.paused &&
		!enemy.is(tags.trainingTarget) &&
		enemy.separationDisabled !== true
}

function getDesiredSpacing(enemy: GameObj, neighbor: GameObj) {
	const combinedRadius = getSeparationRadius(enemy) + getSeparationRadius(neighbor)
	return k.clamp(
		combinedRadius * SEPARATION_RADIUS_FACTOR + EXTRA_SPACING,
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
