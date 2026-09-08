import assert from "node:assert/strict"
import { splitSalvageValue } from "./salvagePickupService"

assert.deepEqual(splitSalvageValue(0), [])
assert.deepEqual(splitSalvageValue(-3), [])
assert.deepEqual(splitSalvageValue(1), [1])
assert.deepEqual(splitSalvageValue(2), [1, 1])
assert.deepEqual(splitSalvageValue(3), [3])
assert.deepEqual(splitSalvageValue(9), [5, 3, 1])
assert.deepEqual(splitSalvageValue(19), [10, 5, 3, 1])
assert.deepEqual(splitSalvageValue(50), [10, 10, 10, 10, 10])

for (let amount = 0; amount <= 100; amount++) {
	const total = splitSalvageValue(amount).reduce((sum, value) => sum + value, 0)
	assert.equal(total, amount, `Split must preserve ${amount} salvage`)
}

console.log("Salvage pickup service tests passed")
