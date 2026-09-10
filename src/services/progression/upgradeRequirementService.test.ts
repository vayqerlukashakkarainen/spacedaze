import type { UpgradeDefinition } from "../../types/upgradeTypes"
import {
	describeRequirements,
	evaluateRequirements,
	validateRequirementGraph,
} from "./upgradeRequirementService"
import { getAllUpgradeDefinitions } from "../../upgrades/upgradeRegistry"
import { PLAYTEST_BUILDS } from "../player/buildPresets"
import { ABILITIES } from "../abilities/abilityRegistry"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const dependent = definition("dependent", {
	allOf: [{ toolKey: "root", minimumStacks: 2 }],
	anyOf: [{ toolKey: "branchA" }, { toolKey: "branchB" }],
})
const levels = new Map<string, number>([
	["root", 1],
	["branchB", 0],
])
const met = evaluateRequirements(dependent, (key) => levels.get(key))
assert(met.met, "allOf and anyOf requirements should accept matching levels")

levels.set("root", 0)
levels.delete("branchB")
const locked = evaluateRequirements(dependent, (key) => levels.get(key))
assert(!locked.met, "requirements should reject missing levels and branches")
assert(locked.unmet.length === 2, "both unmet requirement groups should be reported")
assert(
	describeRequirements(dependent)?.includes("root 2") === true,
	"descriptions should include minimum stack counts"
)

const graphErrors = validateRequirementGraph(
	getAllUpgradeDefinitions(),
	ABILITIES.map((ability) => ability.id)
)
assert(graphErrors.length === 0, graphErrors.join("\n"))

for (const build of PLAYTEST_BUILDS) {
	for (const [toolKey, level] of Object.entries(build.upgrades)) {
		const upgrade = getAllUpgradeDefinitions().find(
			(definition) => definition.toolKey === toolKey
		)
		assert(!!upgrade, `${build.id} references unknown upgrade ${toolKey}`)
		assert(
			level !== undefined && !!upgrade!.levels[level],
			`${build.id} references invalid ${toolKey} level`
		)
	}
}

const ricochetLink = getAllUpgradeDefinitions().find(
	(definition) => definition.toolKey === "ricochetModifierLink"
)
assert(!!ricochetLink, "ricochet modifier link should be registered")
assert(
	!evaluateRequirements(ricochetLink!, () => undefined).met,
	"ricochet modifier link should be locked without ricochet rounds"
)
assert(
	evaluateRequirements(
		ricochetLink!,
		(toolKey) => toolKey === "ricochetRounds" ? 0 : undefined
	).met,
	"one stack of ricochet rounds should unlock the modifier link"
)

const interceptorProtocol = getAllUpgradeDefinitions().find(
	(definition) => definition.toolKey === "followerInterceptorProtocol"
)
assert(!!interceptorProtocol, "interceptor protocol should be registered")
assert(
	!evaluateRequirements(interceptorProtocol!, () => undefined).met,
	"interceptor protocol should require an existing drone upgrade"
)
assert(
	evaluateRequirements(
		interceptorProtocol!,
		(toolKey) => toolKey === "followerBlasterDmg" ? 0 : undefined
	).met,
	"a follower upgrade should unlock interceptor protocol"
)

const afterburnerWake = getAllUpgradeDefinitions().find(
	(definition) => definition.toolKey === "afterburnerWake"
)
assert(!!afterburnerWake, "afterburner wake should be registered")
assert(
	!evaluateRequirements(afterburnerWake!, () => undefined).met,
	"afterburner wake should require Thruster Overdrive"
)
assert(
	evaluateRequirements(
		afterburnerWake!,
		(toolKey) => toolKey === "thrusterOverdrive" ? 0 : undefined
	).met,
	"Thruster Overdrive should unlock afterburner wake"
)

const phaseRam = getAllUpgradeDefinitions().find(
	(definition) => definition.toolKey === "phaseRam"
)
assert(!!phaseRam, "phase ram should be registered")
assert(phaseRam!.levels.length === 3, "phase ram should have three levels")
assert(
	!evaluateRequirements(phaseRam!, () => undefined).met,
	"phase ram should require Space Jump"
)
assert(
	evaluateRequirements(
		phaseRam!,
		(toolKey) => toolKey === "spaceJump" ? 0 : undefined
	).met,
	"Space Jump should unlock phase ram"
)

const lassoUpgradeKeys = [
	"kineticCoupler",
	"torqueSpool",
	"shockCradle",
	"momentumRelay",
	"redlineCable",
]
for (const toolKey of lassoUpgradeKeys) {
	const upgrade = getAllUpgradeDefinitions().find(
		(definition) => definition.toolKey === toolKey
	)
	assert(!!upgrade, `${toolKey} should be registered`)
	assert(
		!evaluateRequirements(upgrade!, () => undefined).met,
		`${toolKey} should require the Salvage Lasso`
	)
	assert(
		evaluateRequirements(
			upgrade!,
			(candidate) => candidate === "salvageLasso" ? 0 : undefined
		).met,
		`Salvage Lasso should unlock ${toolKey}`
	)
}

assert(
	!getAllUpgradeDefinitions().some(
		(definition) => definition.toolKey === "volatileCargo"
	),
	"volatile cargo should be a map objective, not an upgrade"
)

const alterationIngredients: Record<string, readonly string[]> = {
	arcHarpoon: ["salvageLasso", "stunRounds"],
	shrapnelGarden: ["mineLayer", "splitChamber"],
	huntersGeometry: ["tacticalUplink", "hunterGuidance"],
	graviticImpaler: ["gravitySling", "railLance"],
}
for (const [toolKey, ingredients] of Object.entries(alterationIngredients)) {
	const upgrade = getAllUpgradeDefinitions().find(
		(definition) => definition.toolKey === toolKey
	)
	assert(!!upgrade?.alteration, `${toolKey} should be a registered alteration`)
	assert(
		!evaluateRequirements(upgrade!, () => undefined).met,
		`${toolKey} should stay locked without its ingredients`
	)
	assert(
		evaluateRequirements(
			upgrade!,
			(candidate) => ingredients.includes(candidate) ? 0 : undefined
		).met,
		`${toolKey} should unlock when both ingredients are active`
	)
}

const cycleErrors = validateRequirementGraph([
	definition("a", { allOf: [{ toolKey: "b" }] }),
	definition("b", { allOf: [{ toolKey: "a" }] }),
])
assert(cycleErrors.length > 0, "dependency cycles should be detected")

console.log("Upgrade requirement tests passed")

function definition(
	toolKey: string,
	requirements?: UpgradeDefinition["requirements"]
): UpgradeDefinition {
	return {
		toolKey,
		toolName: toolKey,
		category: "combat",
		type: "passive",
		requirements,
		levels: [],
	}
}
