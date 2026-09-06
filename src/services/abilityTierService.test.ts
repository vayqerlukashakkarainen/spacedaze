import assert from "node:assert/strict"
import { RewardRarity } from "../types/rewardTypes"
import {
	beginAbilityTierRun,
	getAbilityTierState,
	getAbilityTierValues,
	getNextAbilityTierRarity,
	registerAbilityTier,
	rollAbilityTierState,
} from "./abilityTierService"

beginAbilityTierRun()
assert.deepEqual(getAbilityTierValues("standardBlaster"), {
	power: 1,
	speed: 1,
	recovery: 1,
})

const uncommon = rollAbilityTierState(
	"standardBlaster",
	"primary",
	RewardRarity.Uncommon,
	() => 0
)
const rare = rollAbilityTierState(
	"standardBlaster",
	"primary",
	RewardRarity.Rare,
	() => 0
)
assert.ok(rare.values.power > uncommon.values.power)
assert.ok(rare.values.speed > uncommon.values.speed)
assert.ok(rare.values.recovery > uncommon.values.recovery)

assert.equal(registerAbilityTier(rare), true)
assert.equal(getAbilityTierState("standardBlaster")?.rarity, RewardRarity.Rare)
assert.equal(registerAbilityTier(uncommon), false)
assert.equal(getAbilityTierState("standardBlaster")?.rarity, RewardRarity.Rare)
assert.equal(
	getNextAbilityTierRarity("standardBlaster"),
	RewardRarity.Epic
)

beginAbilityTierRun()
assert.equal(getAbilityTierState("standardBlaster"), undefined)

console.log("Ability tier service tests passed")
