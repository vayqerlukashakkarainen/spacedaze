import assert from "node:assert/strict"
import { createBudgetEncounterPlan, getEncounterBudget } from "./enemyEncounterBudgetService"

for (let tier = 1; tier <= 5; tier++) {
	for (let seed = 0; seed < 40; seed++) {
		let state = seed + tier * 101
		const random = () => {
			state = state * 1664525 + 1013904223 >>> 0
			return state / 0x100000000
		}
		const plan = createBudgetEncounterPlan(tier, random)
		assert.ok(plan.some((entry) => entry.roles.includes("pressure")))
		assert.ok(plan.reduce((total, entry) => total + entry.cost, 0) <= getEncounterBudget(tier))
		assert.ok(plan.filter((entry) => entry.roles.includes("controller")).length <= 2)
		assert.ok(plan.filter((entry) => entry.roles.includes("support")).length <= 1)
		if (tier < 3) assert.equal(plan.some((entry) => entry.id === "suppressor"), false)
		if (tier < 4) assert.equal(plan.some((entry) => entry.id === "breach-crawler"), false)
	}
}

for (let seed = 0; seed < 40; seed++) {
	let state = seed + 900
	const plan = createBudgetEncounterPlan(5, () => {
		state = state * 1664525 + 1013904223 >>> 0
		return state / 0x100000000
	}, false)
	assert.equal(plan.some((entry) => entry.roles.includes("terrain")), false)
}

console.log("Enemy encounter budget tests passed")
