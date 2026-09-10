import type { GameObj, Vec2 } from "kaplay"
import type { HexGrid } from "../../grid/hexGrid"
import { k } from "../../main"

interface RoomCoverSource {
	id: string
	radius: number
	dynamic: boolean
	position: () => Vec2
	exists: () => boolean
}

export interface RoomCoverDestination {
	sourceId: string
	position: Vec2
}

const sources = new Map<string, RoomCoverSource>()
const reservations = new Map<string, number>()

export function clearRoomCoverSources() {
	sources.clear()
	reservations.clear()
}

export function registerStaticRoomCover(
	id: string,
	position: Vec2,
	radius: number
) {
	sources.set(id, {
		id,
		radius,
		dynamic: false,
		position: () => position,
		exists: () => true,
	})
}

export function registerDynamicRoomCover(
	id: string,
	object: GameObj,
	radius: number
) {
	sources.set(id, {
		id,
		radius,
		dynamic: true,
		position: () => object.pos,
		exists: () => object.exists(),
	})
	object.onDestroy(() => {
		sources.delete(id)
		reservations.delete(id)
	})
}

export function hasDynamicRoomCoverOnLine(start: Vec2, end: Vec2) {
	for (const source of sources.values()) {
		if (!source.dynamic || !source.exists()) continue
		const position = source.position()
		if (position.dist(start) <= source.radius + 4) continue
		if (position.dist(end) <= source.radius + 4) continue
		if (distanceToSegment(position, start, end) <= source.radius) return true
	}
	return false
}

export function acquireRoomCover(
	enemyId: number,
	enemyPosition: Vec2,
	playerPosition: Vec2,
	grid: HexGrid,
	maximumDistance = 360
): RoomCoverDestination | undefined {
	const candidates: Array<RoomCoverDestination & { score: number }> = []
	for (const source of sources.values()) {
		if (!source.exists()) continue
		const reservedBy = reservations.get(source.id)
		if (reservedBy !== undefined && reservedBy !== enemyId) continue
		const sourcePosition = source.position()
		const travelDistance = enemyPosition.dist(sourcePosition)
		if (travelDistance > maximumDistance) continue
		const destination = getDestination(source, playerPosition, grid)
		if (!destination) continue
		candidates.push({
			sourceId: source.id,
			position: destination,
			score: travelDistance + (source.dynamic ? 25 : 0),
		})
	}
	const selected = candidates.sort((first, second) => first.score - second.score)[0]
	if (!selected) return undefined
	reservations.set(selected.sourceId, enemyId)
	return {
		sourceId: selected.sourceId,
		position: selected.position,
	}
}

export function updateRoomCoverDestination(
	sourceId: string,
	playerPosition: Vec2,
	grid: HexGrid
) {
	const source = sources.get(sourceId)
	if (!source?.exists()) return undefined
	return getDestination(source, playerPosition, grid)
}

export function releaseRoomCover(enemyId: number, sourceId?: string) {
	if (sourceId) {
		if (reservations.get(sourceId) === enemyId) reservations.delete(sourceId)
		return
	}
	for (const [id, reservedBy] of reservations) {
		if (reservedBy === enemyId) reservations.delete(id)
	}
}

function getDestination(
	source: RoomCoverSource,
	playerPosition: Vec2,
	grid: HexGrid
) {
	const sourcePosition = source.position()
	const away = sourcePosition.sub(playerPosition)
	if (away.len() <= 0.001) return undefined
	const desired = sourcePosition.add(away.unit().scale(source.radius + 28))
	const cell = grid.screenToHex(desired)
	if (!grid.inBounds(cell) || !grid.isWalkable(cell)) return undefined
	return grid.hexToScreen(cell)
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared <= 0.001) return point.dist(start)
	const t = k.clamp(point.sub(start).dot(segment) / lengthSquared, 0, 1)
	return point.dist(start.add(segment.scale(t)))
}
