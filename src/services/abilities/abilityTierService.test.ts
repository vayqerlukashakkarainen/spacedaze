import assert from "node:assert/strict"
import { RewardRarity } from "../../types/rewardTypes"
import {
	beginAbilityTierRun,
	getAbilityTierState,
	getAbilityTierValues,
	getNextAbilityTierRarity,
	registerAbilityTier,
	rollAbilityTierState,
} from "./abilityTierService"

beginAbilityTierRun()
assert.deepEqual(getAbilityTierValues("rocketPod"), {
	power: 1,
	speed: 1,
	recovery: 1,
})

const uncommon = rollAbilityTierState(
	"rocketPod",
	"secondary",
	RewardRarity.Uncommon,
	() => 0
)
const rare = rollAbilityTierState(
	"rocketPod",
	"secondary",
	RewardRarity.Rare,
	() => 0
)
assert.ok(rare.values.power > uncommon.values.power)
assert.ok(rare.values.speed > uncommon.values.speed)
assert.ok(rare.values.recovery > uncommon.values.recovery)

assert.equal(registerAbilityTier(rare), true)
assert.equal(getAbilityTierState("rocketPod")?.rarity, RewardRarity.Rare)
assert.equal(registerAbilityTier(uncommon), false)
assert.equal(getAbilityTierState("rocketPod")?.rarity, RewardRarity.Rare)
assert.equal(
	getNextAbilityTierRarity("rocketPod"),
	RewardRarity.Epic
)

assert.equal(registerAbilityTier({
	abilityId: "standardBlaster",
	slot: "primary",
	rarity: RewardRarity.Legendary,
	values: { power: 2, speed: 2, recovery: 2 },
}), false)
assert.equal(getAbilityTierState("standardBlaster"), undefined)

beginAbilityTierRun()
assert.equal(getAbilityTierState("rocketPod"), undefined)

console.log("Ability tier service tests passed")
