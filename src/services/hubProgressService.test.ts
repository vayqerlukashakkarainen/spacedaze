import assert from "node:assert/strict"
import {
	buildFacility,
	consumeHubGhostChest,
	discoverBlueprint,
	getFacilityConstruction,
	getFacilityConstructionRemainingMs,
	getHubChestLuck,
	getHubGhostChestCapacity,
	getHubGhostChestStock,
	getHubLevel,
	getHubLevelProgress,
	getUnseenBlueprintKeys,
	hasUnseenBlueprints,
	isFacilityBuilt,
	isFacilityUnlocked,
	markBlueprintsSeen,
	recordHubDeposit,
	resetHubProgress,
	setHubLevelForDebug,
	startFacilityConstruction,
} from "./hubProgressService"

resetHubProgress()
assert.equal(getHubLevel(), 1)
assert.equal(getHubChestLuck(), 0)
assert.equal(getHubGhostChestCapacity("salvage"), 1)
assert.equal(getHubGhostChestStock("salvage"), 1)
assert.equal(getHubGhostChestStock("weapon"), 0)
assert.equal(isFacilityBuilt("trainingRange"), true)
assert.equal(isFacilityUnlocked("contractTerminal"), false)
assert.equal(hasUnseenBlueprints(), false)
assert.equal(discoverBlueprint("weapon:testWeapon"), true)
assert.equal(discoverBlueprint("weapon:testWeapon"), false)
assert.deepEqual(getUnseenBlueprintKeys(), ["weapon:testWeapon"])
markBlueprintsSeen(["weapon:testWeapon"])
assert.equal(hasUnseenBlueprints(), false)

const levelTwo = recordHubDeposit(75)
assert.equal(levelTwo.previousLevel, 1)
assert.equal(levelTwo.currentLevel, 2)
assert.ok(levelTwo.unlocks.includes("CONTRACT TERMINAL"))
assert.equal(getHubGhostChestStock("salvage"), 2)
assert.equal(isFacilityUnlocked("contractTerminal"), true)
assert.equal(buildFacility("contractTerminal"), true)
assert.equal(isFacilityBuilt("contractTerminal"), true)

assert.equal(consumeHubGhostChest("salvage"), true)
assert.equal(getHubGhostChestStock("salvage"), 1)

const levelThree = recordHubDeposit(125)
assert.equal(levelThree.currentLevel, 3)
assert.equal(getHubGhostChestStock("salvage"), 2)
assert.equal(getHubGhostChestStock("weapon"), 1)
assert.equal(getHubChestLuck(), 0.06)

assert.equal(startFacilityConstruction("salvageForge"), true)
assert.equal(getFacilityConstruction()?.facilityId, "salvageForge")
assert.ok(getFacilityConstructionRemainingMs("salvageForge") > 0)
assert.equal(startFacilityConstruction("salvageForge"), false)
assert.equal(isFacilityBuilt("salvageForge"), false)
assert.equal(buildFacility("salvageForge"), true)
assert.equal(getFacilityConstruction(), undefined)

setHubLevelForDebug(5)
assert.equal(getHubGhostChestCapacity("salvage"), 3)
assert.equal(getHubLevelProgress().level, 5)

resetHubProgress()
console.log("Hub progress service tests passed")
