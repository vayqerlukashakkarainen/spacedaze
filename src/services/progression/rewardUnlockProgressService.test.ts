import assert from "node:assert/strict"

const values = new Map<string, string>()
Object.defineProperty(globalThis, "localStorage", {
	value: {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	},
	configurable: true,
})

const {
	describeRewardUnlockRequirement,
	getRewardUnlockRequirements,
	meetsRewardUnlockRequirements,
	recordRewardFloorReached,
	recordRewardKill,
	resetRewardUnlockProgress,
} = await import("./rewardUnlockProgressService")

resetRewardUnlockProgress()

const pulseRequirements = getRewardUnlockRequirements({
	id: "weapon:pulseRepeater",
	kind: "weapon",
	minimumHubLevel: 1,
})
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
for (let index = 0; index < 14; index++) {
	recordRewardKill({ kind: "primary", id: "standardBlaster" })
}
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
recordRewardKill({ kind: "primary", id: "standardBlaster" })
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), true)

const twinNeedleRequirements = getRewardUnlockRequirements({
	id: "weapon:twinNeedle",
	kind: "weapon",
	minimumHubLevel: 1,
})
recordRewardFloorReached(2)
for (let index = 0; index < 10; index++) {
	recordRewardKill({
		kind: "primary",
		id: "standardBlaster",
		critical: true,
	})
}
assert.equal(meetsRewardUnlockRequirements(twinNeedleRequirements), true)
assert.match(
	describeRewardUnlockRequirement(twinNeedleRequirements!.allOf[0]),
	/REACH FLOOR 1\.2/
)

const breachRequirements = getRewardUnlockRequirements({
	id: "weapon:breachCannon",
	kind: "weapon",
	minimumHubLevel: 1,
})
for (let index = 0; index < 10; index++) {
	recordRewardKill({ kind: "environment", explosive: true })
}
assert.equal(meetsRewardUnlockRequirements(breachRequirements), true)

const breachChargeRequirements = getRewardUnlockRequirements({
	id: "active:breachCharge",
	kind: "activeModule",
	minimumHubLevel: 2,
})
recordRewardFloorReached(4)
for (let index = 0; index < 12; index++) {
	recordRewardKill({
		kind: "secondary",
		id: "rocketPod",
		explosive: true,
	})
}
assert.equal(meetsRewardUnlockRequirements(breachChargeRequirements), true)

console.log("Reward unlock progress service tests passed")
