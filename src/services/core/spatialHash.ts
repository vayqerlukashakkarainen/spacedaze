export interface SpatialPoint {
	x: number
	y: number
}

export interface SpatialItem {
	id: number
	pos: SpatialPoint
}

export class SpatialHash<T extends SpatialItem> {
	private buckets = new Map<number, Map<number, T[]>>()
	private activeBuckets: T[][] = []
	private indexedCount = 0

	constructor(readonly cellSize: number) {
		if (!Number.isFinite(cellSize) || cellSize <= 0) {
			throw new Error("Spatial hash cell size must be positive")
		}
	}

	rebuild(items: Iterable<T>) {
		for (const bucket of this.activeBuckets) bucket.length = 0
		this.activeBuckets.length = 0
		this.indexedCount = 0

		for (const item of items) {
			if (!item.pos || !Number.isFinite(item.pos.x) || !Number.isFinite(item.pos.y)) {
				continue
			}
			const cellX = Math.floor(item.pos.x / this.cellSize)
			const cellY = Math.floor(item.pos.y / this.cellSize)
			let column = this.buckets.get(cellX)
			if (!column) {
				column = new Map<number, T[]>()
				this.buckets.set(cellX, column)
			}
			let bucket = column.get(cellY)
			if (!bucket) {
				bucket = []
				column.set(cellY, bucket)
			}
			if (bucket.length === 0) this.activeBuckets.push(bucket)
			bucket.push(item)
			this.indexedCount++
		}
	}

	forEachNearby(
		pos: SpatialPoint,
		radius: number,
		visitor: (item: T) => boolean | void,
		searchPadding = 0
	) {
		const searchRadius = Math.max(0, radius + searchPadding)
		const minX = Math.floor((pos.x - searchRadius) / this.cellSize)
		const maxX = Math.floor((pos.x + searchRadius) / this.cellSize)
		const minY = Math.floor((pos.y - searchRadius) / this.cellSize)
		const maxY = Math.floor((pos.y + searchRadius) / this.cellSize)

		for (let cellY = minY; cellY <= maxY; cellY++) {
			for (let cellX = minX; cellX <= maxX; cellX++) {
				const bucket = this.buckets.get(cellX)?.get(cellY)
				if (!bucket || bucket.length === 0) continue
				for (let index = 0; index < bucket.length; index++) {
					if (visitor(bucket[index]) === false) return false
				}
			}
		}
		return true
	}

	get size() {
		return this.indexedCount
	}

	get activeCellCount() {
		return this.activeBuckets.length
	}

}
