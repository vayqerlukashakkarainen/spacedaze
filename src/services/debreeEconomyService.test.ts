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

loadDepositedDebree(40)
assert.equal(getAvailableDebree(), 40)
assert.equal(spendAvailableDebree(10), true)
assert.equal(getDepositedDebree(), 30)

beginDebreeRun()
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
