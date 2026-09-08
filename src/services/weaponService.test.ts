import assert from "node:assert/strict"
import {
	cycleEquippedWeapon,
	getEquippedWeapon,
	getWeaponDefinition,
	resetWeaponInventory,
	unlockWeapon,
} from "./weaponService"

resetWeaponInventory()
unlockWeapon("railLance", false)

const baseRailLance = getEquippedWeapon()
assert.equal(baseRailLance.id, "standardBlaster")
assert.equal(cycleEquippedWeapon(1).id, "railLance")
assert.equal(getEquippedWeapon().charge?.maxDuration, 1.15)
assert.equal(cycleEquippedWeapon(1).id, "standardBlaster")
assert.equal(cycleEquippedWeapon(-1).id, "railLance")

const plasmaMortar = getWeaponDefinition("plasmaMortar")
assert.equal(plasmaMortar.proximityRadius, 22)
assert.equal(plasmaMortar.splash?.radius, 66)

console.log("Weapon service tests passed")
