import assert from "node:assert/strict"
import { RewardRarity } from "../types/rewardTypes"
import {
	cycleEquippedWeapon,
	equipWeapon,
	getEquippedWeapon,
	getWeaponDefinition,
	getWeaponRewardRarity,
	resetWeaponInventory,
	unlockWeapon,
} from "./weaponService"
import { discoverAbility } from "./abilityRegistry"
import { resetHubProgress } from "./hubProgressService"

resetWeaponInventory()
unlockWeapon("railLance", false)

const baseRailLance = getEquippedWeapon()
assert.equal(baseRailLance.id, "standardBlaster")
assert.equal(cycleEquippedWeapon(1).id, "railLance")
assert.equal(getEquippedWeapon().charge?.maxDuration, 1.15)
assert.equal(cycleEquippedWeapon(1).id, "standardBlaster")
assert.equal(cycleEquippedWeapon(-1).id, "railLance")

resetHubProgress()
resetWeaponInventory()
assert.equal(discoverAbility("twinNeedle"), true)
assert.equal(getEquippedWeapon().id, "twinNeedle")
assert.equal(equipWeapon("standardBlaster"), true)
assert.equal(discoverAbility("twinNeedle"), false)
assert.equal(getEquippedWeapon().id, "standardBlaster")

const plasmaMortar = getWeaponDefinition("plasmaMortar")
assert.equal(plasmaMortar.proximityRadius, 22)
assert.equal(plasmaMortar.splash?.radius, 66)

const scatterArray = getWeaponDefinition("scatterArray")
assert.equal(scatterArray.lifesteal, 0.05)

const twinNeedle = getWeaponDefinition("twinNeedle")
assert.equal(twinNeedle.pattern?.wiggle?.frequency, 26)

assert.equal(getWeaponRewardRarity("standardBlaster"), RewardRarity.Common)
for (const weaponId of [
	"pulseRepeater",
	"twinNeedle",
	"impactDriver",
	"breachCannon",
	"arcCarbine",
	"scatterArray",
	"burstDriver",
	"plasmaMortar",
	"railLance",
] as const) {
	assert.equal(getWeaponRewardRarity(weaponId), RewardRarity.Legendary)
}

console.log("Weapon service tests passed")
