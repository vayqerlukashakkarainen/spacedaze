import assert from "node:assert/strict"
import type { Vec2 } from "kaplay"
import { RunLoop, RunFrameContext } from "./runLoopService"

const vector = { x: 0, y: 0 } as Vec2
const context: RunFrameContext = {
	frame: 1,
	rawDt: 1 / 60,
	dt: 1 / 60,
	scaledDt: 100 / 60,
	timeScale: 1,
	gameState: 1,
	gameplayActive: true,
	paused: false,
	cameraPos: vector,
	cameraScale: vector,
	viewportWidth: 960,
	viewportHeight: 540,
}

const loop = new RunLoop()
const calls: string[] = []
loop.register({
	id: "gameplay-late",
	phase: "gameplay",
	priority: 20,
	update: () => calls.push("gameplay-late"),
})
loop.register({
	id: "movement",
	phase: "movement",
	update: () => calls.push("movement"),
})
loop.register({
	id: "gameplay-early",
	phase: "gameplay",
	priority: -10,
	update: () => calls.push("gameplay-early"),
})
loop.register({
	id: "disabled",
	phase: "ui",
	enabled: () => false,
	update: () => calls.push("disabled"),
})
loop.update(context)
assert.deepEqual(calls, ["movement", "gameplay-early", "gameplay-late"])

const deferredCalls: string[] = []
const deferredLoop = new RunLoop()
let removeLater = () => false
let registeredNewSystem = false
deferredLoop.register({
	id: "registrar",
	phase: "input",
	update: () => {
		deferredCalls.push("registrar")
		if (!registeredNewSystem) {
			registeredNewSystem = true
			deferredLoop.register({
				id: "new-system",
				phase: "gameplay",
				update: () => deferredCalls.push("new-system"),
			})
		}
		removeLater()
	},
})
removeLater = deferredLoop.register({
	id: "removed-later",
	phase: "gameplay",
	update: () => deferredCalls.push("removed-later"),
})
deferredLoop.update(context)
assert.deepEqual(deferredCalls, ["registrar", "removed-later"])
deferredCalls.length = 0
deferredLoop.update(context)
assert.deepEqual(deferredCalls, ["registrar", "new-system"])

const cleanupCalls: string[] = []
const cleanupLoop = new RunLoop()
cleanupLoop.register({
	id: "cleanup-source",
	phase: "gameplay",
	update: () => {
		cleanupCalls.push("update")
		cleanupLoop.deferCleanup(() => cleanupCalls.push("cleanup"))
	},
})
cleanupLoop.update(context)
assert.deepEqual(cleanupCalls, ["update", "cleanup"])

loop.setEnabled(false)
calls.length = 0
loop.update(context)
assert.deepEqual(calls, [])

console.log("runLoopService tests passed")
