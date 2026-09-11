import assert from "node:assert/strict"
import {
	getBossDefinition,
	getBossHealth,
	getBossPhaseIndex,
} from "./bossRegistry"

const impactAce = getBossDefinition("impact-ace")

assert.equal(getBossHealth("impact-ace", 1), 40)
assert.equal(getBossHealth("impact-ace", 2), 40)
assert.equal(getBossHealth("impact-ace", 4), 52)
assert.equal(getBossPhaseIndex(impactAce, 1), 0)
assert.equal(getBossPhaseIndex(impactAce, 0.66), 1)
assert.equal(getBossPhaseIndex(impactAce, 0.32), 2)

const claimkeeper = getBossDefinition("federation-dreadnought")

assert.equal(claimkeeper.name, "THE CLAIMKEEPER")
assert.equal(claimkeeper.phases.length, 3)
assert.equal(claimkeeper.fightStartSound, "machine_boss_fight_start")
assert.equal(getBossHealth("federation-dreadnought", 3), 600)
assert.equal(getBossHealth("federation-dreadnought", 6), 900)
assert.equal(getBossPhaseIndex(claimkeeper, 0.68), 0)
assert.equal(getBossPhaseIndex(claimkeeper, 0.67), 1)
assert.equal(getBossPhaseIndex(claimkeeper, 0.31), 1)
assert.equal(getBossPhaseIndex(claimkeeper, 0.3), 2)

assert.equal(getBossHealth("wake-yardmaster", 1), 750)
assert.equal(getBossHealth("wake-yardmaster", 5), 1190)
assert.equal(getBossHealth("wake-last-beacon", 1), 700)
assert.equal(getBossHealth("wake-last-beacon", 5), 1100)
assert.equal(
	getBossDefinition("wake-yardmaster").fightStartSound,
	"machine_boss_fight_start"
)
assert.equal(
	getBossDefinition("wake-last-beacon").fightStartSound,
	"machine_boss_fight_start"
)
assert.equal(impactAce.fightStartSound, undefined)

console.log("Boss registry tests passed")
