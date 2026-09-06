import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import test from "node:test"
import type { HexCoord } from "./hexCoord"
import {
	buildWalkableHexFlowField,
	findWalkableHexPath,
	getNextWalkableHexStep,
} from "./hexPathfinding"

const DIRECTIONS: HexCoord[] = [
	{ q: 1, r: 0 },
	{ q: 1, r: -1 },
	{ q: 0, r: -1 },
	{ q: -1, r: 0 },
	{ q: -1, r: 1 },
	{ q: 0, r: 1 },
]

function createGrid(width: number, height: number, walls: HexCoord[]) {
	const wallKeys = new Set(walls.map(key))
	const inBounds = (coord: HexCoord) =>
		coord.q >= 0 && coord.q < width && coord.r >= 0 && coord.r < height
	return {
		isWalkable(coord: HexCoord) {
			return inBounds(coord) && !wallKeys.has(key(coord))
		},
		getNeighbors(coord: HexCoord) {
			return DIRECTIONS
				.map((direction) => ({
					coord: { q: coord.q + direction.q, r: coord.r + direction.r },
				}))
				.filter((cell) => inBounds(cell.coord))
		},
	}
}

test("routes through a gap instead of crossing blocked cells", () => {
	const walls = [0, 1, 2, 4].map((r) => ({ q: 2, r }))
	const grid = createGrid(5, 5, walls)
	const path = findWalkableHexPath(grid, { q: 0, r: 1 }, { q: 4, r: 1 })
	assert.ok(path.length > 0)
	assert.ok(path.some((coord) => coord.q === 2 && coord.r === 3))
	assert.ok(path.every((coord) => grid.isWalkable(coord)))
})

test("returns no route when a wall separates the grid", () => {
	const walls = [0, 1, 2, 3, 4].map((r) => ({ q: 2, r }))
	const grid = createGrid(5, 5, walls)
	assert.deepEqual(
		findWalkableHexPath(grid, { q: 0, r: 1 }, { q: 4, r: 1 }),
		[]
	)
})

test("returns the current cell when the goal is already reached", () => {
	const grid = createGrid(3, 3, [])
	assert.deepEqual(
		findWalkableHexPath(grid, { q: 1, r: 1 }, { q: 1, r: 1 }),
		[{ q: 1, r: 1 }]
	)
})

test("a shared flow field routes many enemies around the same walls", () => {
	const walls = [0, 1, 2, 4].map((r) => ({ q: 2, r }))
	const grid = createGrid(5, 5, walls)
	const field = buildWalkableHexFlowField(grid, { q: 4, r: 1 })
	let current = { q: 0, r: 1 }
	const route = [current]
	while (route.length < 20) {
		const next = getNextWalkableHexStep(grid, field, current)
		if (!next) break
		route.push(next)
		current = next
	}
	assert.deepEqual(current, { q: 4, r: 1 })
	assert.ok(route.some((coord) => coord.q === 2 && coord.r === 3))
})

test("shared navigation stays inside the frame budget under enemy load", () => {
	const width = 60
	const height = 45
	const walls: HexCoord[] = []
	for (let r = 0; r < height; r++) {
		if (r !== 31) walls.push({ q: 30, r })
	}
	const grid = createGrid(width, height, walls)
	const goal = { q: 57, r: 22 }
	const starts = Array.from({ length: 200 }, (_, index) => ({
		q: 2 + index % 26,
		r: index % height,
	}))

	for (let index = 0; index < 20; index++) {
		buildWalkableHexFlowField(grid, goal)
	}
	const buildSamples = Array.from({ length: 120 }, () => {
		const startedAt = performance.now()
		buildWalkableHexFlowField(grid, goal)
		return performance.now() - startedAt
	}).sort((first, second) => first - second)

	const field = buildWalkableHexFlowField(grid, goal)
	const querySamples = Array.from({ length: 240 }, () => {
		const startedAt = performance.now()
		for (const start of starts) {
			getNextWalkableHexStep(grid, field, start)
		}
		return performance.now() - startedAt
	}).sort((first, second) => first - second)
	const buildP95 = percentile(buildSamples, 0.95)
	const queryP95 = percentile(querySamples, 0.95)
	console.log(
		`Pathfinding stress: field p95 ${buildP95.toFixed(2)}ms, ` +
		`200 enemies p95 ${queryP95.toFixed(2)}ms`
	)
	assert.ok(buildP95 < 8, `flow-field p95 exceeded 8ms: ${buildP95}ms`)
	assert.ok(queryP95 < 2, `200 enemy queries exceeded 2ms: ${queryP95}ms`)
})

function key(coord: HexCoord) {
	return `${coord.q},${coord.r}`
}

function percentile(samples: number[], fraction: number) {
	return samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))]
}
