import assert from "node:assert/strict"
import type { GameObj } from "kaplay"
import {
	clearCadencedSystemEntries,
	createCadencedSystem,
	updateCadencedSystems,
} from "./cadencedSystemService"

interface TestOwner {
	id: number
	destroy: () => void
	onDestroy: (callback: () => void) => void
}

function createOwner(id: number): TestOwner {
	const destroyCallbacks: Array<() => void> = []
	return {
		id,
		destroy() {
			for (const callback of destroyCallbacks) callback()
		},
		onDestroy(callback) {
			destroyCallbacks.push(callback)
		},
	}
}

const updates = new Map<number, number>()
const system = createCadencedSystem<{ owner: GameObj }>({
	id: "test",
	rate: 20,
	updateBucket(entries) {
		for (const entry of entries) {
			updates.set(entry.owner.id, (updates.get(entry.owner.id) ?? 0) + 1)
		}
	},
})

const owners = [createOwner(0), createOwner(1), createOwner(2)]
for (const owner of owners) system.add({ owner: owner as unknown as GameObj })
for (let frame = 0; frame < 6; frame++) updateCadencedSystems(1 / 60)

assert.deepEqual([...updates.entries()].sort(), [[0, 2], [1, 2], [2, 2]])

owners[1].destroy()
for (let frame = 0; frame < 3; frame++) updateCadencedSystems(1 / 60)
assert.equal(updates.get(0), 3)
assert.equal(updates.get(1), 2)
assert.equal(updates.get(2), 3)

clearCadencedSystemEntries()

const removalVisits: number[] = []
const removalSystem = createCadencedSystem<{ owner: GameObj }>({
	id: "removal-during-update",
	rate: 60,
	updateBucket(entries) {
		const countAtStart = entries.length
		for (let index = 0; index < countAtStart; index++) {
			const entry = entries[index]
			assert.ok(entry)
			removalVisits.push(entry.owner.id)
			if (index === 0) owners[1].destroy()
		}
	},
})

for (const owner of owners) removalSystem.add({ owner: owner as unknown as GameObj })
updateCadencedSystems(1 / 60)
assert.deepEqual(removalVisits, [0, 1, 2])

removalVisits.length = 0
updateCadencedSystems(1 / 60)
assert.deepEqual(removalVisits.sort(), [0, 2])

clearCadencedSystemEntries()

const updateCountsByFrameRate = (frames: number, delta: number) => {
	const counts = new Map<number, number>()
	const frameRateSystem = createCadencedSystem<{ owner: GameObj }>({
		id: `frame-rate-${frames}`,
		rate: 20,
		updateBucket(entries) {
			for (const entry of entries) {
				counts.set(entry.owner.id, (counts.get(entry.owner.id) ?? 0) + 1)
			}
		},
	})
	for (const owner of owners) {
		frameRateSystem.add({ owner: owner as unknown as GameObj })
	}
	for (let frame = 0; frame < frames; frame++) updateCadencedSystems(delta)
	return [...counts.entries()].sort()
}

assert.deepEqual(
	updateCountsByFrameRate(30, 1 / 30),
	[[0, 20], [1, 20], [2, 20]]
)
clearCadencedSystemEntries()
assert.deepEqual(
	updateCountsByFrameRate(120, 1 / 120),
	[[0, 20], [1, 20], [2, 20]]
)
clearCadencedSystemEntries()
console.log("Cadenced system service tests passed")
