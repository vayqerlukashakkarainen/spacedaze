import type { HexCoord } from "./hexCoord"

export interface WalkableHexGrid {
	isWalkable(coord: HexCoord): boolean
	getNeighbors(coord: HexCoord): Array<{ coord: HexCoord }>
}

interface OpenPathNode {
	coord: HexCoord
	priority: number
}

const MAX_PATH_VISITS = 2400
const MAX_FLOW_FIELD_VISITS = 10000

export type HexFlowField = Map<string, number>

export function buildWalkableHexFlowField(
	grid: WalkableHexGrid,
	goal: HexCoord
) {
	const distances: HexFlowField = new Map()
	if (!grid.isWalkable(goal)) return distances

	const queue: HexCoord[] = [{ ...goal }]
	distances.set(coordKey(goal), 0)
	let queueIndex = 0
	while (
		queueIndex < queue.length &&
		queueIndex < MAX_FLOW_FIELD_VISITS
	) {
		const current = queue[queueIndex++]
		const currentDistance = distances.get(coordKey(current))!
		for (const neighbor of grid.getNeighbors(current)) {
			const neighborKey = coordKey(neighbor.coord)
			if (distances.has(neighborKey) || !grid.isWalkable(neighbor.coord)) continue
			distances.set(neighborKey, currentDistance + 1)
			queue.push({ ...neighbor.coord })
		}
	}
	return distances
}

export function getNextWalkableHexStep(
	grid: WalkableHexGrid,
	flowField: HexFlowField,
	start: HexCoord
) {
	const currentDistance = flowField.get(coordKey(start))
	if (currentDistance === undefined || currentDistance === 0) return undefined
	let bestCoord: HexCoord | undefined
	let bestDistance = currentDistance
	for (const neighbor of grid.getNeighbors(start)) {
		if (!grid.isWalkable(neighbor.coord)) continue
		const distance = flowField.get(coordKey(neighbor.coord))
		if (distance === undefined || distance >= bestDistance) continue
		bestCoord = neighbor.coord
		bestDistance = distance
	}
	return bestCoord ? { ...bestCoord } : undefined
}

export function findWalkableHexPath(
	grid: WalkableHexGrid,
	start: HexCoord,
	goal: HexCoord
) {
	if (!grid.isWalkable(start) || !grid.isWalkable(goal)) return []
	if (sameCoord(start, goal)) return [{ ...start }]

	const open: OpenPathNode[] = []
	const cameFrom = new Map<string, HexCoord>()
	const costByCell = new Map<string, number>([[coordKey(start), 0]])
	pushOpenNode(open, { coord: start, priority: coordDistance(start, goal) })
	let visited = 0

	while (open.length > 0 && visited < MAX_PATH_VISITS) {
		const current = popOpenNode(open)
		if (!current) break
		visited++
		if (sameCoord(current.coord, goal)) {
			return reconstructPath(cameFrom, current.coord)
		}
		const currentKey = coordKey(current.coord)
		const currentCost = costByCell.get(currentKey)
		if (currentCost === undefined) continue
		for (const neighbor of grid.getNeighbors(current.coord)) {
			if (!grid.isWalkable(neighbor.coord)) continue
			const neighborKey = coordKey(neighbor.coord)
			const nextCost = currentCost + 1
			if (nextCost >= (costByCell.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
				continue
			}
			costByCell.set(neighborKey, nextCost)
			cameFrom.set(neighborKey, current.coord)
			pushOpenNode(open, {
				coord: neighbor.coord,
				priority: nextCost + coordDistance(neighbor.coord, goal),
			})
		}
	}
	return []
}

function reconstructPath(cameFrom: Map<string, HexCoord>, goal: HexCoord) {
	const path: HexCoord[] = [{ ...goal }]
	let current = goal
	while (cameFrom.has(coordKey(current))) {
		current = cameFrom.get(coordKey(current))!
		path.push({ ...current })
	}
	path.reverse()
	return path
}

function pushOpenNode(heap: OpenPathNode[], node: OpenPathNode) {
	heap.push(node)
	let index = heap.length - 1
	while (index > 0) {
		const parent = Math.floor((index - 1) / 2)
		if (heap[parent].priority <= node.priority) break
		heap[index] = heap[parent]
		index = parent
	}
	heap[index] = node
}

function popOpenNode(heap: OpenPathNode[]) {
	if (heap.length === 0) return undefined
	const root = heap[0]
	const last = heap.pop()!
	if (heap.length === 0) return root
	let index = 0
	while (true) {
		const left = index * 2 + 1
		const right = left + 1
		if (left >= heap.length) break
		const child = right < heap.length && heap[right].priority < heap[left].priority
			? right
			: left
		if (heap[child].priority >= last.priority) break
		heap[index] = heap[child]
		index = child
	}
	heap[index] = last
	return root
}

function coordDistance(first: HexCoord, second: HexCoord) {
	const q = Math.abs(first.q - second.q)
	const r = Math.abs(first.r - second.r)
	const s = Math.abs(-first.q - first.r - (-second.q - second.r))
	return Math.max(q, r, s)
}

function coordKey(coord: HexCoord) {
	return `${coord.q},${coord.r}`
}

function sameCoord(first: HexCoord, second: HexCoord) {
	return first.q === second.q && first.r === second.r
}
