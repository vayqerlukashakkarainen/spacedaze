import assert from "node:assert/strict"
import {
	formatInputBinding,
	getInputBinding,
	getStrafeInputMode,
	onInputBindingsChanged,
	rebindInputAction,
	resetInputBindings,
	setStrafeInputMode,
} from "./inputBindingService"

resetInputBindings()
assert.equal(getStrafeInputMode(), "toggle")
assert.deepEqual(getInputBinding("moveUp"), {
	device: "key",
	input: "w",
})
assert.deepEqual(getInputBinding("moveDown"), {
	device: "key",
	input: "s",
})
assert.deepEqual(getInputBinding("primaryWheel"), {
	device: "key",
	input: "q",
})
assert.deepEqual(getInputBinding("lasso"), {
	device: "mouse",
	input: "right",
})
assert.deepEqual(getInputBinding("secondary"), {
	device: "key",
	input: "e",
})
assert.deepEqual(getInputBinding("strafe"), {
	device: "key",
	input: "shift",
})
assert.deepEqual(getInputBinding("mobility"), {
	device: "key",
	input: "space",
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

setStrafeInputMode("hold")
assert.equal(getStrafeInputMode(), "hold")

resetInputBindings()
assert.equal(getStrafeInputMode(), "toggle")
assert.deepEqual(getInputBinding("moveUp"), {
	device: "key",
	input: "w",
})

console.log("Input binding service tests passed")
