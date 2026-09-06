import assert from "node:assert/strict"
import {
	clearAbilitySlot,
	equipAbility,
	getAbilityLoadout,
	resetAbilityLoadout,
	setAbilityLoadout,
} from "./abilityLoadoutService"
import { getAbilityDefinition } from "./abilityRegistry"

const hubLevelOneAdditions = [
	"pulseRepeater",
	"twinNeedle",
	"impactDriver",
	"repulsorPulse",
	"decoyBeacon",
	"scrapMine",
	"retroBurst",
	"driftBrake",
	"gravitySling",
] as const

for (const id of hubLevelOneAdditions) {
	const definition = getAbilityDefinition(id)
	assert.ok(definition, `${id} should be registered as an ability`)
	assert.equal(
		definition.minimumHubLevel,
		1,
		`${id} should be available at hub level 1`
	)
}

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

equipAbility("primary", "pulseRepeater")
equipAbility("secondary", "decoyBeacon")
equipAbility("mobility", "gravitySling")
assert.deepEqual(getAbilityLoadout(), {
	primary: "pulseRepeater",
	secondary: "decoyBeacon",
	mobility: "gravitySling",
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
