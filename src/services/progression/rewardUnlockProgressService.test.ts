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
	recordRewardRunCompleted,
	resetRewardUnlockProgress,
	unlockRewardRequirementsForDebug,
} = await import("./rewardUnlockProgressService")

resetRewardUnlockProgress()

const pulseRequirements = getRewardUnlockRequirements({
	id: "weapon:pulseRepeater",
	kind: "weapon",
	minimumHubLevel: 1,
})
assert.equal(getRewardUnlockRequirements({
	id: "weapon:standardBlaster",
	kind: "weapon",
}), undefined)
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
for (let index = 0; index < 14; index++) {
	recordRewardKill({ kind: "primary", id: "standardBlaster" })
}
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
recordRewardKill({ kind: "primary", id: "standardBlaster" })
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
for (let index = 0; index < 4; index++) recordRewardRunCompleted()
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), false)
recordRewardRunCompleted()
assert.equal(meetsRewardUnlockRequirements(pulseRequirements), true)
assert.match(
	describeRewardUnlockRequirement(pulseRequirements!.allOf[0]),
	/RUNS COMPLETED  5 \/ 5/
)

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
const twinNeedleDepthRequirement = twinNeedleRequirements!.allOf.find(
	(requirement) => requirement.metric === "maxDepth"
)
assert.ok(twinNeedleDepthRequirement)
assert.match(
	describeRewardUnlockRequirement(twinNeedleDepthRequirement),
	/REACH FLOOR 1\.2/
)

const phaseBoomerangRequirements = getRewardUnlockRequirements({
	id: "weapon:phaseBoomerang",
	kind: "weapon",
	minimumHubLevel: 2,
})
assert.equal(phaseBoomerangRequirements?.anyOf?.length, 2)
assert.equal(meetsRewardUnlockRequirements(phaseBoomerangRequirements), false)
recordRewardFloorReached(3)
assert.equal(meetsRewardUnlockRequirements(phaseBoomerangRequirements), true)

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

resetRewardUnlockProgress()
const debugRequirements = [
	pulseRequirements,
	twinNeedleRequirements,
	phaseBoomerangRequirements,
	breachRequirements,
	breachChargeRequirements,
]
unlockRewardRequirementsForDebug(debugRequirements)
for (const requirements of debugRequirements) {
	assert.equal(
		meetsRewardUnlockRequirements(requirements),
		true,
		"unlockall should satisfy every mastery requirement"
	)
}

console.log("Reward unlock progress service tests passed")
