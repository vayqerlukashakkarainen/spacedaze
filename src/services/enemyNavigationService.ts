import type { GameObj, Vec2 } from "kaplay"
import { gridRegistry } from "../grid/gridRegistry"
import type { HexCoord } from "../grid/hexCoord"
import { hexNeighbors, hexToString } from "../grid/hexCoord"
import type { HexGrid } from "../grid/hexGrid"
import {
	buildWalkableHexFlowField,
	findWalkableHexPath,
	getNextWalkableHexStep,
	type HexFlowField,
} from "../grid/hexPathfinding"
import { k } from "../main"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"

interface EnemyNavigationState {
	lineGrid: HexGrid | undefined
	lineStartCellKey: string
	lineTargetCellKey: string
	lineClear: boolean
	nextLineCheckAt: number
}

interface CachedFlowField {
	field: HexFlowField
	builtAt: number
	lastUsedAt: number
}

const navigationByEnemy = new Map<number, EnemyNavigationState>()
const flowFieldsByGrid = new WeakMap<HexGrid, Map<string, CachedFlowField>>()
const REPATH_INTERVAL = 0.4
const RECOVERY_SEARCH_RADIUS = 8
const WAYPOINT_REACHED_FACTOR = 0.3
const MAX_CACHED_FLOW_FIELDS = 12
const MAX_FLOW_BUILDS_PER_FRAME = 2
let flowBuildFrameTime = Number.NEGATIVE_INFINITY
let flowBuildCount = 0

export function getEnemyNavigationDirection(
	enemy: GameObj,
	preferredDirection: Vec2,
	target: Vec2
) {
	const preferred = normalizedOrZero(preferredDirection)
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid || !enemy.exists()) return preferred

	let start = grid.screenToHex(enemy.pos)
	if (!grid.isWalkable(start)) {
		const recoveryCell = findNearestWalkableCell(grid, start)
		if (!recoveryCell) return k.vec2(0)
		enemy.pos = grid.hexToScreen(recoveryCell)
		start = recoveryCell
		clearEnemyNavigationPath(enemy.id)
	}

	const preferredProbe = enemy.pos.add(
		preferred.scale(grid.config.hexSize * 1.35)
	)
	const targetCell = findNearestWalkableCell(grid, grid.screenToHex(target))
	if (!targetCell) return getSafeLocalDirection(grid, start, enemy.pos, preferred)
	const state = getEnemyNavigationState(enemy)
	const startCellKey = hexToString(start)
	const targetCellKey = hexToString(targetCell)
	if (
		state.lineGrid !== grid ||
		state.lineStartCellKey !== startCellKey ||
		state.lineTargetCellKey !== targetCellKey ||
		k.time() >= state.nextLineCheckAt
	) {
		state.lineGrid = grid
		state.lineStartCellKey = startCellKey
		state.lineTargetCellKey = targetCellKey
		state.lineClear = lineIsWalkable(grid, enemy.pos, target)
		state.nextLineCheckAt = k.time() + 0.16 + (enemy.id % 5) * 0.012
	}
	if (
		state.lineClear &&
		lineIsWalkable(grid, enemy.pos, preferredProbe)
	) return preferred

	const flowField = getSharedFlowField(grid, targetCell, targetCellKey)
	if (!flowField) {
		return getSafeLocalDirection(grid, start, enemy.pos, preferred)
	}
	const nextPathCell = getNextWalkableHexStep(grid, flowField, start)
	if (!nextPathCell) {
		return getSafeLocalDirection(grid, start, enemy.pos, preferred)
	}
	let waypoint = grid.hexToScreen(nextPathCell)
	if (
		enemy.pos.dist(waypoint) <=
		grid.config.hexSize * WAYPOINT_REACHED_FACTOR
	) {
		const followingCell = getNextWalkableHexStep(grid, flowField, nextPathCell)
		if (followingCell) waypoint = grid.hexToScreen(followingCell)
	}
	return normalizedOrZero(waypoint.sub(enemy.pos))
}

export function getEnemyNavigationTarget(enemy: GameObj, target: Vec2) {
	const toTarget = target.sub(enemy.pos)
	const direction = getEnemyNavigationDirection(enemy, toTarget, target)
	return enemy.pos.add(direction.scale(Math.max(1, toTarget.len())))
}

export function pickRandomWalkableEnemyRoute(
	enemy: GameObj,
	minimumSteps: number = 3
): Vec2[] | undefined {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid || !enemy.exists()) return undefined

	let start = grid.screenToHex(enemy.pos)
	if (!grid.isWalkable(start)) {
		const recoveryCell = findNearestWalkableCell(grid, start)
		if (!recoveryCell) return []
		enemy.pos = grid.hexToScreen(recoveryCell)
		start = recoveryCell
		clearEnemyNavigationPath(enemy.id)
	}

	const candidates = grid.getCurrentLayerCells()
		.filter((cell) => grid.isWalkable(cell.coord))
	for (let index = candidates.length - 1; index > 0; index--) {
		const randomIndex = Math.floor(k.rand(0, index + 1))
		const current = candidates[index]
		candidates[index] = candidates[randomIndex]
		candidates[randomIndex] = current
	}

	let fallbackPath: HexCoord[] = []
	for (const candidate of candidates) {
		const path = findWalkableHexPath(grid, start, candidate.coord)
		if (path.length <= 1) continue
		if (path.length > fallbackPath.length) fallbackPath = path
		if (path.length - 1 < minimumSteps) continue
		return path.slice(1).map((coord) => grid.hexToScreen(coord))
	}
	return fallbackPath.slice(1).map((coord) => grid.hexToScreen(coord))
}

export function hasEnemyLineOfSight(enemy: GameObj, target: Vec2) {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	if (!grid || !enemy.exists()) return true

	const startCell = grid.screenToHex(enemy.pos)
	const targetCell = grid.screenToHex(target)
	if (!grid.isWalkable(startCell) || !grid.isWalkable(targetCell)) return false

	const state = getEnemyNavigationState(enemy)
	const startCellKey = hexToString(startCell)
	const targetCellKey = hexToString(targetCell)
	if (
		state.lineGrid !== grid ||
		state.lineStartCellKey !== startCellKey ||
		state.lineTargetCellKey !== targetCellKey ||
		k.time() >= state.nextLineCheckAt
	) {
		state.lineGrid = grid
		state.lineStartCellKey = startCellKey
		state.lineTargetCellKey = targetCellKey
		state.lineClear = lineIsWalkable(grid, enemy.pos, target)
		state.nextLineCheckAt = k.time() + 0.16 + (enemy.id % 5) * 0.012
	}
	return state.lineClear
}

function getEnemyNavigationState(enemy: GameObj) {
	const existing = navigationByEnemy.get(enemy.id)
	if (existing) return existing
	const state: EnemyNavigationState = {
		lineGrid: undefined,
		lineStartCellKey: "",
		lineTargetCellKey: "",
		lineClear: false,
		nextLineCheckAt: 0,
	}
	navigationByEnemy.set(enemy.id, state)
	enemy.onDestroy(() => navigationByEnemy.delete(enemy.id))
	return state
}

function clearEnemyNavigationPath(enemyId: number) {
	const state = navigationByEnemy.get(enemyId)
	if (!state) return
	state.lineGrid = undefined
	state.lineStartCellKey = ""
	state.lineTargetCellKey = ""
	state.nextLineCheckAt = 0
}

function getSharedFlowField(
	grid: HexGrid,
	targetCell: HexCoord,
	targetCellKey: string
) {
	let gridFields = flowFieldsByGrid.get(grid)
	if (!gridFields) {
		gridFields = new Map()
		flowFieldsByGrid.set(grid, gridFields)
	}
	const now = k.time()
	const existing = gridFields.get(targetCellKey)
	if (existing && now - existing.builtAt < REPATH_INTERVAL) {
		existing.lastUsedAt = now
		return existing.field
	}
	if (now !== flowBuildFrameTime) {
		flowBuildFrameTime = now
		flowBuildCount = 0
	}
	if (flowBuildCount >= MAX_FLOW_BUILDS_PER_FRAME) {
		if (existing) existing.lastUsedAt = now
		return existing?.field
	}
	flowBuildCount++
	const field = buildWalkableHexFlowField(grid, targetCell)
	gridFields.set(targetCellKey, {
		field,
		builtAt: now,
		lastUsedAt: now,
	})
	pruneFlowFieldCache(gridFields)
	return field
}

function pruneFlowFieldCache(fields: Map<string, CachedFlowField>) {
	while (fields.size > MAX_CACHED_FLOW_FIELDS) {
		let oldestKey: string | undefined
		let oldestUse = Number.POSITIVE_INFINITY
		for (const [key, entry] of fields) {
			if (entry.lastUsedAt >= oldestUse) continue
			oldestKey = key
			oldestUse = entry.lastUsedAt
		}
		if (!oldestKey) return
		fields.delete(oldestKey)
	}
}

function findNearestWalkableCell(
	grid: HexGrid,
	origin: HexCoord
): HexCoord | undefined {
	if (grid.isWalkable(origin)) return origin
	const visited = new Set<string>([hexToString(origin)])
	let frontier = [{ ...origin }]
	for (let radius = 1; radius <= RECOVERY_SEARCH_RADIUS; radius++) {
		const nextFrontier: HexCoord[] = []
		for (const coord of frontier) {
			for (const neighbor of hexNeighbors(coord)) {
				const key = hexToString(neighbor)
				if (visited.has(key)) continue
				visited.add(key)
				if (!grid.inBounds(neighbor)) continue
				if (grid.isWalkable(neighbor)) return neighbor
				nextFrontier.push(neighbor)
			}
		}
		frontier = nextFrontier
	}
	return undefined
}

function lineIsWalkable(grid: HexGrid, start: Vec2, end: Vec2) {
	const distance = start.dist(end)
	const samples = Math.max(1, Math.ceil(distance / (grid.config.hexSize * 0.45)))
	for (let index = 1; index <= samples; index++) {
		const sample = start.lerp(end, index / samples)
		if (!grid.isWalkable(grid.screenToHex(sample))) return false
	}
	return true
}

function getSafeLocalDirection(
	grid: HexGrid,
	start: HexCoord,
	position: Vec2,
	preferred: Vec2
) {
	let bestDirection = k.vec2(0)
	let bestAlignment = Number.NEGATIVE_INFINITY
	for (const neighbor of grid.getNeighbors(start)) {
		if (!grid.isWalkable(neighbor.coord)) continue
		const direction = normalizedOrZero(grid.hexToScreen(neighbor.coord).sub(position))
		const alignment = direction.dot(preferred)
		if (alignment <= bestAlignment) continue
		bestAlignment = alignment
		bestDirection = direction
	}
	return bestDirection
}

function normalizedOrZero(direction: Vec2) {
	return direction.len() > 0.001 ? direction.unit() : k.vec2(0)
}
