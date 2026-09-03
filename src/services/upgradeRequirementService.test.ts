import type { UpgradeDefinition } from "../types/upgradeTypes"
import {
	describeRequirements,
	evaluateRequirements,
	validateRequirementGraph,
} from "./upgradeRequirementService"
import { getAllUpgradeDefinitions } from "../upgrades/upgradeRegistry"

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

const graphErrors = validateRequirementGraph(getAllUpgradeDefinitions())
assert(graphErrors.length === 0, graphErrors.join("\n"))

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
