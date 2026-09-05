import assert from "node:assert/strict"
import type { GameObj } from "kaplay"
import {
	clearContinuousSystemEntries,
	createContinuousSystem,
	updateContinuousSystems,
} from "./continuousSystemService"

function createOwner(id: number) {
	const destroyCallbacks: Array<() => void> = []
	return {
		id,
		destroy() {
			for (const callback of destroyCallbacks) callback()
		},
		onDestroy(callback: () => void) {
			destroyCallbacks.push(callback)
		},
	}
}

const visited: number[] = []
const system = createContinuousSystem<{ owner: GameObj }>({
	id: "test",
	updateBatch(entries) {
		for (const entry of entries) visited.push(entry.owner.id)
	},
})
const first = createOwner(1)
const second = createOwner(2)
system.add({ owner: first as unknown as GameObj })
system.add({ owner: second as unknown as GameObj })

updateContinuousSystems()
assert.deepEqual(visited, [1, 2])

visited.length = 0
first.destroy()
updateContinuousSystems()
assert.deepEqual(visited, [2])

clearContinuousSystemEntries()
console.log("Continuous system service tests passed")
