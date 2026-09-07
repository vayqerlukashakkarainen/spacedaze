import assert from "node:assert/strict"
import { isDebreeAvailable, SalvagerCargo, type SalvagerDebree } from "./salvagerCargoService"

interface TestDebree extends SalvagerDebree {
	value: number
	runLevelXp: boolean
	alive: boolean
}

function piece(value = 1): TestDebree {
	return { value, runLevelXp: true, alive: true, exists() { return this.alive } }
}

const first = new SalvagerCargo<TestDebree>(1)
const second = new SalvagerCargo<TestDebree>(2)
const pieces = [1, 2, 3, 4, 5, 5].map(piece)
for (const item of pieces.slice(0, 5)) assert.equal(first.load(item), true)
assert.equal(first.items.length, 5)
assert.equal(first.load(pieces[5]), false, "A sixth piece must remain in the world")
assert.equal(first.shouldReturn(true), true, "A full drone returns even with more debris nearby")
assert.equal(second.load(pieces[0]), false, "Two drones cannot carry the same piece")
assert.equal(isDebreeAvailable(pieces[0]), false, "Carried pieces cannot be collected again")
assert.equal(second.load(pieces[5]), true, "Capacity is independent for each drone")

const delivered = first.release(true)
assert.deepEqual(delivered, pieces.slice(0, 5), "Delivery releases the original entities")
assert.deepEqual(delivered.map((item) => item.value), [1, 2, 3, 4, 5])
assert.ok(delivered.every((item) => item.runLevelXp && item.readyForPlayer))
assert.ok(delivered.every((item) => item.carriedBy === undefined && !isDebreeAvailable(item)))
assert.equal(first.items.length, 0)
assert.equal(first.returning, false)
assert.equal(first.release(true).length, 0, "Delivery cannot duplicate cargo")

assert.equal(second.shouldReturn(true), false)
assert.equal(second.shouldReturn(false), true, "Partial loads return when the area is clear")
assert.equal(second.shouldReturn(true), true, "A returning drone finishes delivery before seeking again")
const dropped = second.release(false)
assert.equal(dropped[0], pieces[5])
assert.equal(isDebreeAvailable(dropped[0]), true, "Death or role changes release recoverable cargo")
assert.equal(first.load(dropped[0]), true)

const collecting = piece()
collecting.collection = {}
assert.equal(second.load(collecting), false, "Do not steal pieces in the player's pickup animation")
const vanished = piece()
assert.equal(second.load(vanished), true)
vanished.alive = false
assert.equal(second.items.length, 0, "Level cleanup removes stale cargo references")
assert.equal(second.shouldReturn(false), false)
assert.equal(second.release(false).length, 0)

console.log("Salvager cargo tests passed")
