import assert from "node:assert/strict"
import {
	clearAbilitySlot,
	equipAbility,
	getAbilityLoadout,
	resetAbilityLoadout,
	setAbilityLoadout,
} from "./abilityLoadoutService"
import {
	ABILITIES,
	discoverAbility,
	getAbilityDefinition,
	hasUndiscoveredAbilities,
} from "./abilityRegistry"
import {
	beginAbilityTierRun,
	endAbilityTierRun,
	getAbilityTierValues,
	registerAbilityTier,
} from "./abilityTierService"
import { RewardRarity } from "../../types/rewardTypes"

const hubLevelOneAdditions = [
	"pulseRepeater",
	"twinNeedle",
	"repulsorPulse",
	"decoyBeacon",
	"scrapMine",
	"retroBurst",
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

for (const id of ["gravitonCollapse", "ghostFleet", "scrapColossus"] as const) {
	const definition = getAbilityDefinition(id)
	assert.ok(definition, `${id} should be registered as an ability`)
	assert.equal(definition.slot, "ultimate")
	assert.equal(definition.resource.type, "meter")
}

const droidFrenzy = getAbilityDefinition("droidFrenzy")
assert.equal(droidFrenzy?.slot, "secondary")
assert.equal(droidFrenzy?.minimumHubLevel, 3)
assert.equal(droidFrenzy?.icon, "active_droid_frenzy")
assert.deepEqual(droidFrenzy?.resource, { type: "cooldown", duration: 18 })

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

const phaseSurge = getAbilityDefinition("phaseSurge")
assert.equal(phaseSurge?.resource.type, "charges")
assert.equal(phaseSurge?.description.includes("2 seconds"), true)
equipAbility("mobility", "phaseSurge")
assert.equal(getAbilityLoadout().mobility, "phaseSurge")

beginAbilityTierRun()
registerAbilityTier({
	abilityId: "rocketPod",
	slot: "secondary",
	rarity: RewardRarity.Epic,
	values: { power: 1.5, speed: 1.45, recovery: 1.4 },
})
endAbilityTierRun()
assert.equal(getAbilityLoadout().primary, "pulseRepeater")
assert.deepEqual(getAbilityTierValues("rocketPod"), {
	power: 1,
	speed: 1,
	recovery: 1,
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

assert.equal(hasUndiscoveredAbilities(), true)
for (const ability of ABILITIES) discoverAbility(ability.id, false)
assert.equal(hasUndiscoveredAbilities(), false)

console.log("Ability loadout service tests passed")
