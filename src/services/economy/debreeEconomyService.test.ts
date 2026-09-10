import assert from "node:assert/strict"
import {
	addAvailableDebree,
	beginDebreeRun,
	depositCarriedDebree,
	extractDebreeRun,
	getAvailableDebree,
	getCarriedDebree,
	getDepositedDebree,
	loadDepositedDebree,
	loseCarriedDebree,
	spendAvailableDebree,
} from "./debreeEconomyService"
import {
	getAbilityTierState,
	registerAbilityTier,
} from "../abilities/abilityTierService"
import { RewardRarity } from "../../types/rewardTypes"

loadDepositedDebree(40)
assert.equal(getAvailableDebree(), 40)
assert.equal(spendAvailableDebree(10), true)
assert.equal(getDepositedDebree(), 30)

registerAbilityTier({
	abilityId: "rocketPod",
	slot: "secondary",
	rarity: RewardRarity.Epic,
	values: { power: 1.5, speed: 1.45, recovery: 1.4 },
})
beginDebreeRun()
assert.equal(
	getAbilityTierState("rocketPod")?.rarity,
	RewardRarity.Epic,
	"Equipment collected in the hub should retain its tier when a run begins"
)
assert.equal(getAvailableDebree(), 0)
addAvailableDebree(17)
assert.equal(spendAvailableDebree(5), true)
assert.equal(getCarriedDebree(), 12)
assert.equal(depositCarriedDebree(5), 5)
assert.equal(getCarriedDebree(), 7)
assert.equal(depositCarriedDebree(), 7)
assert.equal(getDepositedDebree(), 42)

addAvailableDebree(9)
assert.deepEqual(loseCarriedDebree(), { deposited: 12, lost: 9 })
assert.equal(getAvailableDebree(), 42)

beginDebreeRun()
addAvailableDebree(8)
assert.deepEqual(extractDebreeRun(), { deposited: 8, lost: 0 })
assert.equal(getDepositedDebree(), 50)

console.log("Debree economy service tests passed")
