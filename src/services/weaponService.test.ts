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
assert.equal(baseRailLance.projectileSpeedMultiplier, 2.4)
assert.equal(baseRailLance.projectileLengthScale, 2)
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
assert.equal(twinNeedle.triggerModifier?.mode, "charge")
assert.equal(twinNeedle.charge?.maxDuration, 0.8)
assert.equal(twinNeedle.charge?.maxDamageMultiplier, 2.5)
assert.equal(twinNeedle.charge?.maxSpeedMultiplier, 1.4)
assert.equal(twinNeedle.charge?.projectileScaleMultiplier?.max, 1.75)
assert.equal(twinNeedle.charge?.piercing?.maxPierces, 3)

const railLance = getWeaponDefinition("railLance")
assert.equal(railLance.targetingGuidance?.turnSpeed, 0.014)
assert.equal(railLance.targetingGuidance?.acquireDelay, 0)

const railgun = getWeaponDefinition("railgun")
assert.equal(railgun.triggerModifier?.mode, "charge")
assert.equal(railgun.charge?.maxDuration, 1.2)
assert.equal(railgun.charge?.autoFireDelay, 0.3)
assert.equal(railgun.charge?.piercing?.maxPierces, 6)
assert.equal(railgun.charge?.maxSpeedMultiplier, 1.9)
assert.equal(railgun.charge?.projectileScaleMultiplier?.max, 2.2)
assert.equal(railgun.projectileScale, 3)
assert.equal(railgun.projectileSpeedMultiplier, 4.2)
assert.deepEqual(railgun.projectileTint, [255, 210, 55])

const projectileSpeeds = {
	standardBlaster: 2.4,
	pulseRepeater: 2.832,
	twinNeedle: 3.072,
	impactDriver: 0.816,
	breachCannon: 1.728,
	arcCarbine: 2.832,
	scatterArray: 2.112,
	burstDriver: 2.76,
	plasmaMortar: 1.152,
	railLance: 5.4,
	railgun: 4.2,
} as const
for (const [weaponId, speedMultiplier] of Object.entries(projectileSpeeds)) {
	const weapon = getWeaponDefinition(
		weaponId as keyof typeof projectileSpeeds
	)
	assert.equal(weapon.projectileSpeedMultiplier, speedMultiplier)
	assert.equal(weapon.projectileLengthScale, 2)
}

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
	"railgun",
] as const) {
	assert.equal(getWeaponRewardRarity(weaponId), RewardRarity.Legendary)
}

console.log("Weapon service tests passed")
