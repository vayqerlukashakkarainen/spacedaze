import assert from "node:assert/strict"
import {
	addLassoTokens,
	getLassoRigProgress,
	getLassoRigRank,
	getLassoRigUpgradeCost,
	getLassoRigValue,
	getLassoTokens,
	loadLassoRigProgress,
	resetLassoRigProgress,
	spendLassoTokens,
	upgradeLassoRig,
} from "./lassoRigService"

resetLassoRigProgress()
assert.equal(getLassoTokens(), 0)
assert.equal(getLassoRigRank("partExtractor"), 0)
assert.equal(getLassoRigValue("massCoupler"), 1)

assert.equal(addLassoTokens(4.8), 4)
assert.equal(spendLassoTokens(1), true)
assert.equal(getLassoTokens(), 3)
assert.equal(upgradeLassoRig("partExtractor"), true)
assert.equal(getLassoRigRank("partExtractor"), 1)
assert.equal(getLassoRigUpgradeCost("partExtractor"), undefined)

assert.equal(upgradeLassoRig("massCoupler"), true)
assert.equal(getLassoRigValue("massCoupler"), 1.2)
const snapshot = getLassoRigProgress()
snapshot.ranks.massCoupler = 99
assert.equal(getLassoRigRank("massCoupler"), 1)

loadLassoRigProgress({
	tokens: 7.9,
	ranks: { massCoupler: 99, forceAmplifier: -2 },
})
assert.equal(getLassoTokens(), 7)
assert.equal(getLassoRigRank("massCoupler"), 3)
assert.equal(getLassoRigRank("forceAmplifier"), 0)
assert.equal(getLassoRigValue("massCoupler"), 1.6)

console.log("Lasso rig service tests passed")
