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

const claimkeeper = getBossDefinition("federation-dreadnought")

assert.equal(claimkeeper.name, "THE CLAIMKEEPER")
assert.equal(claimkeeper.phases.length, 3)
assert.equal(getBossHealth("federation-dreadnought", 3), 120)
assert.equal(getBossHealth("federation-dreadnought", 6), 180)
assert.equal(getBossPhaseIndex(claimkeeper, 0.68), 0)
assert.equal(getBossPhaseIndex(claimkeeper, 0.67), 1)
assert.equal(getBossPhaseIndex(claimkeeper, 0.31), 1)
assert.equal(getBossPhaseIndex(claimkeeper, 0.3), 2)

console.log("Boss registry tests passed")
