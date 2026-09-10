import assert from "node:assert/strict"
import {
	applyPlayerStatusEffect,
	clearPlayerStatusEffects,
	clearPlayerStatusEffectsFromSource,
	getPlayerStatusMultiplier,
	updatePlayerStatusEffects,
} from "./playerStatusEffectService"

clearPlayerStatusEffects()
applyPlayerStatusEffect({ id: "slow", sourceId: 1, stat: "movement", multiplier: 0.8, duration: 2 })
applyPlayerStatusEffect({ id: "slow", sourceId: 2, stat: "movement", multiplier: 0.75, duration: 1 })
assert.ok(Math.abs(getPlayerStatusMultiplier("movement") - 0.6) < 0.0001)
updatePlayerStatusEffects(1.1)
assert.equal(getPlayerStatusMultiplier("movement"), 0.8)
clearPlayerStatusEffectsFromSource(1)
assert.equal(getPlayerStatusMultiplier("movement"), 1)

console.log("Player status effect tests passed")
