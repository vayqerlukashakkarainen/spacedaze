import assert from "node:assert/strict"
import {
	addPsionicPlates,
	collectPsionicPlate,
	getPsionicPlateProgress,
	getPsionicPlates,
	hasClaimedMiniBossPlate,
	loadPsionicPlateProgress,
	resetPsionicPlateProgress,
	rollPsionicPlateDrop,
	spendPsionicPlates,
} from "./psionicPlateService"

resetPsionicPlateProgress()
assert.deepEqual(rollPsionicPlateDrop("impact-ace", 0.99), {
	drops: true,
	guaranteed: true,
})

const firstPickup = collectPsionicPlate("impact-ace")
assert.equal(firstPickup.firstClear, true)
assert.equal(getPsionicPlates(), 1)
assert.equal(hasClaimedMiniBossPlate("impact-ace"), true)
assert.deepEqual(rollPsionicPlateDrop("impact-ace", 0.19), {
	drops: true,
	guaranteed: false,
})
assert.deepEqual(rollPsionicPlateDrop("impact-ace", 0.2), {
	drops: false,
	guaranteed: false,
})

assert.equal(addPsionicPlates(2.8), 2)
assert.equal(spendPsionicPlates(2), true)
assert.equal(spendPsionicPlates(2), false)
assert.equal(getPsionicPlates(), 1)

loadPsionicPlateProgress(4.9, [
	"wake-boiler-hulk",
	"wake-boiler-hulk",
	"not-a-mini-boss",
])
assert.deepEqual(getPsionicPlateProgress(), {
	plates: 4,
	firstClearMiniBossIds: ["wake-boiler-hulk"],
})

console.log("Psionic Plate economy tests passed")
