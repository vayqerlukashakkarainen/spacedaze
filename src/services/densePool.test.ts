import assert from "node:assert/strict"
import { DensePool } from "./densePool"

interface TestItem {
	id: number
	value: string
}

const pool = new DensePool<TestItem>((item) => item.id)
pool.add({ id: 1, value: "one" })
pool.add({ id: 2, value: "two" })
pool.add({ id: 3, value: "three" })
assert.equal(pool.size, 3)

assert.equal(pool.remove(2), true)
assert.equal(pool.size, 2)
assert.equal(pool.has(2), false)
assert.equal(pool.get(3)?.value, "three")

pool.add({ id: 3, value: "updated" })
assert.equal(pool.size, 2)
assert.equal(pool.get(3)?.value, "updated")

const visited: number[] = []
pool.forEach((item) => {
	visited.push(item.id)
	if (item.id === 1) {
		pool.remove(3)
		pool.add({ id: 4, value: "four" })
	}
})
assert.deepEqual(visited.sort(), [1, 3])
assert.equal(pool.has(3), false)
assert.equal(pool.get(4)?.value, "four")
assert.equal(pool.size, 2)

pool.clear()
assert.equal(pool.size, 0)

console.log("densePool tests passed")

