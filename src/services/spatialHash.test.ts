import assert from "node:assert/strict"
import { SpatialHash } from "./spatialHash"

interface Item {
	id: number
	pos: { x: number; y: number }
}

const hash = new SpatialHash<Item>(10)
const items: Item[] = [
	{ id: 1, pos: { x: 1, y: 1 } },
	{ id: 2, pos: { x: 12, y: 1 } },
	{ id: 3, pos: { x: -15, y: -5 } },
]
hash.rebuild(items)
assert.equal(hash.size, 3)
assert.equal(hash.activeCellCount, 3)

const nearby: number[] = []
hash.forEachNearby({ x: 0, y: 0 }, 10, (item) => nearby.push(item.id))
assert.deepEqual(nearby.sort(), [1, 2])

const stopped: number[] = []
const completed = hash.forEachNearby({ x: 0, y: 0 }, 30, (item) => {
	stopped.push(item.id)
	return false
})
assert.equal(completed, false)
assert.equal(stopped.length, 1)

items[0].pos = { x: 50, y: 50 }
hash.rebuild(items)
const oldCell: number[] = []
hash.forEachNearby({ x: 0, y: 0 }, 5, (item) => oldCell.push(item.id))
assert.equal(oldCell.includes(1), false)

console.log("spatialHash tests passed")

