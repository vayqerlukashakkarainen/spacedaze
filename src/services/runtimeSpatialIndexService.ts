import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { setPerformanceCounter } from "./frameProfilerService"
import { SpatialHash } from "./spatialHash"

const SPATIAL_CELL_SIZE = 96
const LEGACY_POSITION_PADDING = 48
const spatialHash = new SpatialHash<GameObj & { pos: Vec2 }>(SPATIAL_CELL_SIZE)

export interface SpatialQueryOptions {
	allTags?: string[]
	anyTags?: string[]
	excludeIds?: ReadonlySet<number> | readonly number[]
}

export function rebuildRuntimeSpatialIndex() {
	const objects = k.get(tags.gameLoop) as Array<GameObj & { pos: Vec2 }>
	spatialHash.rebuild(objects)
	setPerformanceCounter("spatialObjects", spatialHash.size)
	setPerformanceCounter("spatialCells", spatialHash.activeCellCount)
}

export function forEachSpatialNearby(
	pos: Vec2,
	radius: number,
	options: SpatialQueryOptions,
	visitor: (obj: GameObj) => boolean | void
) {
	const radiusSquared = radius * radius
	return spatialHash.forEachNearby(
		pos,
		radius,
		(obj) => {
			if (!obj.exists() || !obj.pos || isExcluded(obj.id, options.excludeIds)) return
			if (!matchesTags(obj, options)) return
			const dx = obj.pos.x - pos.x
			const dy = obj.pos.y - pos.y
			if (dx * dx + dy * dy > radiusSquared) return
			return visitor(obj)
		},
		LEGACY_POSITION_PADDING
	)
}

export function findSpatialNearby(
	pos: Vec2,
	radius: number,
	options: SpatialQueryOptions
) {
	let found: GameObj | undefined
	forEachSpatialNearby(pos, radius, options, (obj) => {
		found = obj
		return false
	})
	return found
}

export function findClosestSpatial(
	pos: Vec2,
	radius: number,
	options: SpatialQueryOptions
) {
	let closest: GameObj | undefined
	let closestDistanceSquared = radius * radius
	forEachSpatialNearby(pos, radius, options, (obj) => {
		const dx = obj.pos.x - pos.x
		const dy = obj.pos.y - pos.y
		const distanceSquared = dx * dx + dy * dy
		if (distanceSquared >= closestDistanceSquared) return
		closest = obj
		closestDistanceSquared = distanceSquared
	})
	return closest
}

export function querySpatialNearby(
	pos: Vec2,
	radius: number,
	options: SpatialQueryOptions
) {
	const results: GameObj[] = []
	forEachSpatialNearby(pos, radius, options, (obj) => results.push(obj))
	return results
}

function matchesTags(obj: GameObj, options: SpatialQueryOptions) {
	if (options.allTags) {
		for (const tag of options.allTags) {
			if (!obj.tags.includes(tag)) return false
		}
	}
	if (options.anyTags && options.anyTags.length > 0) {
		let found = false
		for (const tag of options.anyTags) {
			if (!obj.tags.includes(tag)) continue
			found = true
			break
		}
		if (!found) return false
	}
	return true
}

function isExcluded(
	id: number,
	excluded: ReadonlySet<number> | readonly number[] | undefined
) {
	if (!excluded) return false
	return Array.isArray(excluded)
		? excluded.includes(id)
		: (excluded as ReadonlySet<number>).has(id)
}
