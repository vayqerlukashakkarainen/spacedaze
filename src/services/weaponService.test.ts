import assert from "node:assert/strict"
import {
	beginAbilityTierRun,
	registerAbilityTier,
} from "./abilityTierService"
import {
	getEquippedWeapon,
	resetWeaponInventory,
	unlockWeapon,
} from "./weaponService"

beginAbilityTierRun()
resetWeaponInventory()
unlockWeapon("railLance")

const baseRailLance = getEquippedWeapon()
assert.equal(baseRailLance.id, "railLance")
assert.equal(baseRailLance.charge?.maxDuration, 1.15)

registerAbilityTier({
	abilityId: "railLance",
	slot: "primary",
	rarity: "epic",
	values: {
		power: 1.5,
		speed: 1.5,
		recovery: 1.5,
	},
})

const upgradedRailLance = getEquippedWeapon()
assert.ok(upgradedRailLance.charge)
assert.ok(upgradedRailLance.charge.maxDuration < baseRailLance.charge!.maxDuration)
assert.equal(
	Number(upgradedRailLance.charge.maxDuration.toFixed(3)),
	Number((1.15 / 1.5).toFixed(3))
)

console.log("Weapon service tests passed")
