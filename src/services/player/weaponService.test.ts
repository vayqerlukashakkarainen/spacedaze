import assert from "node:assert/strict"
import { RewardRarity } from "../../types/rewardTypes"
import {
	cycleEquippedWeapon,
	equipWeapon,
	getFavoriteWeaponIds,
	getEquippedWeapon,
	getWeaponDefinition,
	getWeaponRewardRarity,
	isWeaponOwned,
	resetWeaponInventory,
	toggleWeaponFavorite,
	unlockWeapon,
} from "./weaponService"
import { discoverAbility } from "../abilities/abilityRegistry"
import { resetHubProgress } from "../hub/hubProgressService"
import { getArmorerWeaponCost } from "../hub/armorerService"

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

assert.equal(toggleWeaponFavorite("standardBlaster"), true)
assert.equal(toggleWeaponFavorite("railLance"), true)
assert.deepEqual(getFavoriteWeaponIds(), ["standardBlaster", "railLance"])
assert.equal(cycleEquippedWeapon(1).id, "standardBlaster")
assert.equal(toggleWeaponFavorite("standardBlaster"), false)
assert.deepEqual(getFavoriteWeaponIds(), ["railLance"])
assert.equal(cycleEquippedWeapon(1).id, "railLance")

resetHubProgress()
resetWeaponInventory()
assert.equal(discoverAbility("twinNeedle"), true)
assert.equal(getEquippedWeapon().id, "twinNeedle")
assert.equal(equipWeapon("standardBlaster"), true)
assert.equal(discoverAbility("twinNeedle"), false)
assert.equal(getEquippedWeapon().id, "standardBlaster")

assert.equal(getArmorerWeaponCost(1), 1)
assert.equal(getArmorerWeaponCost(2), 2)
assert.equal(getArmorerWeaponCost(3), 3)

assert.equal(discoverAbility("pulseRepeater", false), true)
assert.equal(isWeaponOwned("pulseRepeater"), true)
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
assert.equal(railLance.projectileSpeedMultiplier, 9.6)
assert.equal(railLance.projectileLengthScale, 4)

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

const phaseBoomerang = getWeaponDefinition("phaseBoomerang")
assert.equal(phaseBoomerang.returning?.trackPlayer, true)
assert.equal(phaseBoomerang.returning?.afterBounces, true)
assert.equal(phaseBoomerang.returning?.delay, 1.2)
assert.equal(phaseBoomerang.piercing?.maxPierces, 3)
assert.deepEqual(phaseBoomerang.projectileAcceleration, {
	acceleration: 700,
	maxSpeedMultiplier: 1.15,
})
assert.deepEqual(phaseBoomerang.bounce, {
	maxBounces: 2,
	speedRetention: 0.95,
	damageRetention: 0.72,
	seekNextTarget: true,
	seekDistance: 420,
})
assert.equal(phaseBoomerang.knockback, 52)

const minecaster = getWeaponDefinition("minecaster")
assert.equal(minecaster.mine?.maxActive, 3)
assert.equal(minecaster.mine?.replaceOldest, true)

const pulseRepeater = getWeaponDefinition("pulseRepeater")
assert.equal(pulseRepeater.ultimateChargePerHit, 0.1)
assert.equal(pulseRepeater.sustainedFire?.spoolDuration, 1.8)
assert.equal(pulseRepeater.sustainedFire?.minimumCooldownMultiplier, 0.62)
assert.equal(pulseRepeater.sustainedFire?.maximumSpreadMultiplier, 2.25)
assert.deepEqual(pulseRepeater.sustainedFire?.overheat, {
	heatPerShot: 0.009,
	coolingPerSecond: 0.45,
	recoveryThreshold: 0.15,
})

assert.equal(twinNeedle.hitCombo?.requiredHits, 2)
assert.equal(getWeaponDefinition("burstDriver").hitCombo?.requiredHits, 3)
assert.equal(getWeaponDefinition("breachCannon").componentDamageMultiplier, 2.5)
assert.equal(getWeaponDefinition("arcCarbine").projectileSpawnOffset, 1)

const weaponUnlockLevels = {
	standardBlaster: 1,
	pulseRepeater: 1,
	twinNeedle: 1,
	breachCannon: 1,
	arcCarbine: 1,
	scatterArray: 2,
	burstDriver: 2,
	plasmaMortar: 2,
	railLance: 3,
	railgun: 3,
	phaseBoomerang: 2,
	minecaster: 2,
} as const
for (const [weaponId, minimumHubLevel] of Object.entries(weaponUnlockLevels)) {
	assert.equal(
		getWeaponDefinition(weaponId as keyof typeof weaponUnlockLevels)
			.minimumHubLevel,
		minimumHubLevel
	)
}

const projectileSpeeds = {
	standardBlaster: 2.4,
	pulseRepeater: 2.832,
	twinNeedle: 3.072,
	breachCannon: 1.728,
	arcCarbine: 2.832,
	scatterArray: 2.112,
	burstDriver: 2.76,
	plasmaMortar: 1.152,
	railLance: 9.6,
	railgun: 4.2,
	phaseBoomerang: 2.4,
	minecaster: 1.15,
} as const
for (const [weaponId, speedMultiplier] of Object.entries(projectileSpeeds)) {
	const weapon = getWeaponDefinition(
		weaponId as keyof typeof projectileSpeeds
	)
	assert.equal(weapon.projectileSpeedMultiplier, speedMultiplier)
	assert.equal(
		weapon.projectileLengthScale,
		weapon.id === "railLance" ? 4 :
			weapon.id === "phaseBoomerang" || weapon.id === "minecaster" ? 1 : 2
	)
}

assert.equal(getWeaponRewardRarity("standardBlaster"), RewardRarity.Common)
for (const weaponId of [
	"pulseRepeater",
	"twinNeedle",
	"breachCannon",
	"arcCarbine",
	"scatterArray",
	"burstDriver",
	"plasmaMortar",
	"railLance",
	"railgun",
	"phaseBoomerang",
	"minecaster",
] as const) {
	assert.equal(getWeaponRewardRarity(weaponId), RewardRarity.Legendary)
}

console.log("Weapon service tests passed")
