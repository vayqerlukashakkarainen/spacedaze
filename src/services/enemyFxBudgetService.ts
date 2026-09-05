import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import { trailEmitter } from "../particles"
import { tags } from "../tags"
import {
	incrementPerformanceCounter,
	setPerformanceCounter,
} from "./frameProfilerService"

const MAX_EXHAUST_EMISSIONS_PER_FRAME = 24
const EXHAUST_VIEW_MARGIN = 72

let cachedFrame = -1
let cachedEnemyCount = 0
let cachedCadence = 1

export function emitBudgetedEnemyExhaust(
	enemy: GameObj,
	position: Vec2,
	direction: number
) {
	refreshBudget()
	incrementPerformanceCounter("enemyFxRequested")

	if (!isNearViewport(position)) {
		incrementPerformanceCounter("enemyFxCulled")
		return false
	}
	if ((enemy.id + cachedFrame) % cachedCadence !== 0) {
		incrementPerformanceCounter("enemyFxBudgetSkipped")
		return false
	}

	trailEmitter.emitter.position = position
	trailEmitter.emitter.direction = direction
	trailEmitter.emit(1)
	incrementPerformanceCounter("enemyFxEmitted")
	return true
}

function refreshBudget() {
	const frame = Math.floor(k.time() * 60)
	if (frame === cachedFrame) return
	cachedFrame = frame
	cachedEnemyCount = k.get(tags.enemy).length
	cachedCadence = Math.max(
		1,
		Math.ceil(cachedEnemyCount / MAX_EXHAUST_EMISSIONS_PER_FRAME)
	)
	setPerformanceCounter("enemyFxCrowd", cachedEnemyCount)
	setPerformanceCounter("enemyFxCadence", cachedCadence)
}

function isNearViewport(position: Vec2) {
	const screenPosition = k.toScreen(position)
	return screenPosition.x >= -EXHAUST_VIEW_MARGIN &&
		screenPosition.x <= k.width() + EXHAUST_VIEW_MARGIN &&
		screenPosition.y >= -EXHAUST_VIEW_MARGIN &&
		screenPosition.y <= k.height() + EXHAUST_VIEW_MARGIN
}
