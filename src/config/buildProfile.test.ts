import assert from "node:assert/strict"
import { canAdvanceRunAfterDepth, getBuildLimits } from "./buildProfile"

assert.deepEqual(getBuildLimits("demo"), {
	maxRunDepth: 5,
	maxHubLevel: 3,
})
assert.equal(getBuildLimits("full").maxRunDepth, Number.POSITIVE_INFINITY)
assert.equal(getBuildLimits("full").maxHubLevel, Number.POSITIVE_INFINITY)
assert.equal(canAdvanceRunAfterDepth(2, "demo"), true)
assert.equal(canAdvanceRunAfterDepth(4, "demo"), true)
assert.equal(canAdvanceRunAfterDepth(5, "demo"), false)
assert.equal(canAdvanceRunAfterDepth(999, "full"), true)

console.log("Build profile tests passed")
