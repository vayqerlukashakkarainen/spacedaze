import { getSelectedContract } from "./contractService"
import {
	deriveLevelSelectionSeed,
	deriveRunFloorSeed,
	getRunLevelPool,
	type RunLevelKey,
	selectNextRunLevel,
} from "./runLevelPool"
import { startRunStats } from "./runStatsService"
import { getUnlockedWarpZones, getWarpZone } from "./warpZoneService"
import { beginDebreeRun } from "./debreeEconomyService"

export interface RunFloorSelection {
	levelKey: RunLevelKey
	depth: number
	mapSeed: number
}

export interface RunRouteSnapshot {
	zoneId: string
	poolId: string
	baseSeed: number
	depth: number
	currentLevelKey: RunLevelKey
	visitedLevelKeys: RunLevelKey[]
	levelHistory: RunLevelKey[]
}

interface ActiveRunRoute extends RunRouteSnapshot {
	visited: Set<RunLevelKey>
	currentFloor: RunFloorSelection
}

let queuedRunSeed: number | undefined
let activeRun: ActiveRunRoute | undefined

export function setNextRunSeed(seed: number) {
	queuedRunSeed = seed
}

export function beginRunSession(zoneId: string): RunFloorSelection | undefined {
	const zone = getWarpZone(zoneId)
	if (!zone) return undefined
	const pool = getRunLevelPool(zone.poolId)
	if (!pool || pool.levelKeys.length === 0) return undefined

	const baseSeed = queuedRunSeed ?? randomSeed()
	queuedRunSeed = undefined
	const firstLevel = selectNextRunLevel(
		pool,
		new Set(),
		deriveLevelSelectionSeed(baseSeed, 1)
	)
	if (!firstLevel) return undefined
	const currentFloor = createFloor(firstLevel, baseSeed, 1)
	activeRun = {
		zoneId,
		poolId: pool.id,
		baseSeed,
		depth: 1,
		currentLevelKey: firstLevel,
		visitedLevelKeys: [firstLevel],
		levelHistory: [firstLevel],
		visited: new Set([firstLevel]),
		currentFloor,
	}
	beginDebreeRun()
	startRunStats(getSelectedContract()?.name ?? "UNASSIGNED EXPEDITION")
	return currentFloor
}

export function beginRandomRunSession(): RunFloorSelection | undefined {
	const zones = getUnlockedWarpZones()
	if (zones.length === 0) return undefined
	const zone = zones[Math.floor(Math.random() * zones.length)]
	return beginRunSession(zone.id)
}

export function advanceRunSession(): RunFloorSelection | undefined {
	if (!activeRun) return undefined
	const pool = getRunLevelPool(activeRun.poolId)
	if (!pool || pool.levelKeys.length === 0) return undefined

	const depth = activeRun.depth + 1
	const levelKey = selectNextRunLevel(
		pool,
		activeRun.visited,
		deriveLevelSelectionSeed(activeRun.baseSeed, depth)
	)
	if (!levelKey) return undefined
	const currentFloor = createFloor(levelKey, activeRun.baseSeed, depth)
	activeRun.depth = depth
	activeRun.currentLevelKey = levelKey
	activeRun.currentFloor = currentFloor
	activeRun.levelHistory.push(levelKey)
	if (!activeRun.visited.has(levelKey)) {
		activeRun.visited.add(levelKey)
		activeRun.visitedLevelKeys.push(levelKey)
	}
	return currentFloor
}

export function getCurrentRunFloor() {
	return activeRun?.currentFloor
}

export function getRunRouteSnapshot(): RunRouteSnapshot | undefined {
	if (!activeRun) return undefined
	return {
		zoneId: activeRun.zoneId,
		poolId: activeRun.poolId,
		baseSeed: activeRun.baseSeed,
		depth: activeRun.depth,
		currentLevelKey: activeRun.currentLevelKey,
		visitedLevelKeys: [...activeRun.visitedLevelKeys],
		levelHistory: [...activeRun.levelHistory],
	}
}

export function runSessionActive() {
	return activeRun !== undefined
}

export function endRunSession() {
	activeRun = undefined
}

function createFloor(
	levelKey: RunLevelKey,
	baseSeed: number,
	depth: number
): RunFloorSelection {
	return {
		levelKey,
		depth,
		mapSeed: deriveRunFloorSeed(baseSeed, depth, levelKey),
	}
}

function randomSeed() {
	return Math.floor(Math.random() * 0xffffffff) + 1
}
