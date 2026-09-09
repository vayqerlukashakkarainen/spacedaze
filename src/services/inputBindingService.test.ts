import assert from "node:assert/strict"
import {
	formatInputBinding,
	getInputBinding,
	onInputBindingsChanged,
	rebindInputAction,
	resetInputBindings,
} from "./inputBindingService"

resetInputBindings()
assert.deepEqual(getInputBinding("moveUp"), {
	device: "key",
	input: "w",
})
assert.deepEqual(getInputBinding("moveDown"), {
	device: "key",
	input: "s",
})

let changeCount = 0
const unsubscribe = onInputBindingsChanged(() => changeCount++)
const change = rebindInputAction("moveUp", {
	device: "key",
	input: "s",
})
assert.equal(change.swappedAction, "moveDown")
assert.deepEqual(getInputBinding("moveUp"), {
	device: "key",
	input: "s",
})
assert.deepEqual(getInputBinding("moveDown"), {
	device: "key",
	input: "w",
})
assert.equal(changeCount, 1)
unsubscribe()

assert.equal(formatInputBinding({ device: "mouse", input: "right" }), "RIGHT MOUSE")
assert.equal(formatInputBinding({ device: "key", input: "escape" }), "ESC")

resetInputBindings()
assert.deepEqual(getInputBinding("moveUp"), {
	device: "key",
	input: "w",
})

console.log("Input binding service tests passed")
