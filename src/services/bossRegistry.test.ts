import assert from "node:assert/strict"
import {
	getBossDefinition,
	getBossHealth,
	getBossPhaseIndex,
} from "./bossRegistry"

const impactAce = getBossDefinition("impact-ace")

assert.equal(getBossHealth("impact-ace", 1), 26)
assert.equal(getBossHealth("impact-ace", 2), 26)
assert.equal(getBossHealth("impact-ace", 4), 34)
assert.equal(getBossPhaseIndex(impactAce, 1), 0)
assert.equal(getBossPhaseIndex(impactAce, 0.66), 1)
assert.equal(getBossPhaseIndex(impactAce, 0.32), 2)

console.log("Boss registry tests passed")
