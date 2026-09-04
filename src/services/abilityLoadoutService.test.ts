import assert from "node:assert/strict"
import {
	clearAbilitySlot,
	equipAbility,
	getAbilityLoadout,
	resetAbilityLoadout,
	setAbilityLoadout,
} from "./abilityLoadoutService"

resetAbilityLoadout()
assert.deepEqual(getAbilityLoadout(), { primary: "standardBlaster" })

equipAbility("primary", "railLance")
equipAbility("secondary", "gravityCharge")
equipAbility("mobility", "phaseJump")
equipAbility("ultimate", "phaseNova")
assert.deepEqual(getAbilityLoadout(), {
	primary: "railLance",
	secondary: "gravityCharge",
	mobility: "phaseJump",
	ultimate: "phaseNova",
})

clearAbilitySlot("secondary")
assert.equal(getAbilityLoadout().secondary, undefined)

setAbilityLoadout({
	primary: "standardBlaster",
	mobility: "thrusterOverdrive",
})
assert.deepEqual(getAbilityLoadout(), {
	primary: "standardBlaster",
	secondary: undefined,
	mobility: "thrusterOverdrive",
	ultimate: undefined,
})

console.log("Ability loadout service tests passed")
