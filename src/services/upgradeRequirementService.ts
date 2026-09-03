import type {
	UpgradeDefinition,
	UpgradeRequirement,
} from "../types/upgradeTypes"

export interface UpgradeRequirementEvaluation {
	met: boolean
	unmet: string[]
}

export function evaluateRequirements(
	definition: UpgradeDefinition,
	resolveLevel: (toolKey: string) => number | undefined,
	resolveName: (toolKey: string) => string = (toolKey) => toolKey
): UpgradeRequirementEvaluation {
	const requirements = definition.requirements
	if (!requirements) return { met: true, unmet: [] }

	const format = (requirement: UpgradeRequirement) =>
		formatRequirement(requirement, resolveName)
	const unmet = (requirements.allOf ?? [])
		.filter((requirement) => !requirementMet(requirement, resolveLevel))
		.map(format)
	const anyOf = requirements.anyOf ?? []
	if (
		anyOf.length > 0 &&
		!anyOf.some((requirement) => requirementMet(requirement, resolveLevel))
	) {
		unmet.push(`One of: ${anyOf.map(format).join(" / ")}`)
	}

	return { met: unmet.length === 0, unmet }
}

export function describeRequirements(
	definition: UpgradeDefinition,
	resolveName: (toolKey: string) => string = (toolKey) => toolKey
) {
	const requirements = definition.requirements
	if (!requirements) return undefined
	const format = (requirement: UpgradeRequirement) =>
		formatRequirement(requirement, resolveName)
	const groups: string[] = []
	if (requirements.allOf?.length) {
		groups.push(requirements.allOf.map(format).join(" + "))
	}
	if (requirements.anyOf?.length) {
		groups.push(`One of: ${requirements.anyOf.map(format).join(" / ")}`)
	}
	return groups.join("; ") || undefined
}

export function validateRequirementGraph(
	definitions: readonly UpgradeDefinition[]
) {
	const definitionsByKey = new Map(
		definitions.map((definition) => [definition.toolKey, definition])
	)
	const errors: string[] = []

	for (const definition of definitions) {
		for (const requirement of getRequirements(definition)) {
			if (!definitionsByKey.has(requirement.toolKey)) {
				errors.push(
					`${definition.toolKey} requires unknown upgrade ${requirement.toolKey}`
				)
			}
		}
	}

	const visiting = new Set<string>()
	const visited = new Set<string>()
	const visit = (toolKey: string, path: string[]) => {
		if (visiting.has(toolKey)) {
			errors.push(`Upgrade dependency cycle: ${[...path, toolKey].join(" -> ")}`)
			return
		}
		if (visited.has(toolKey)) return
		visiting.add(toolKey)
		const definition = definitionsByKey.get(toolKey)
		if (definition) {
			for (const requirement of getRequirements(definition)) {
				if (definitionsByKey.has(requirement.toolKey)) {
					visit(requirement.toolKey, [...path, toolKey])
				}
			}
		}
		visiting.delete(toolKey)
		visited.add(toolKey)
	}

	for (const definition of definitions) visit(definition.toolKey, [])
	return errors
}

function getRequirements(definition: UpgradeDefinition) {
	return [
		...(definition.requirements?.allOf ?? []),
		...(definition.requirements?.anyOf ?? []),
	]
}

function requirementMet(
	requirement: UpgradeRequirement,
	resolveLevel: (toolKey: string) => number | undefined
) {
	const level = resolveLevel(requirement.toolKey)
	const minimumStacks = Math.max(1, requirement.minimumStacks ?? 1)
	return level !== undefined && level + 1 >= minimumStacks
}

function formatRequirement(
	requirement: UpgradeRequirement,
	resolveName: (toolKey: string) => string
) {
	const minimumStacks = Math.max(1, requirement.minimumStacks ?? 1)
	const name = resolveName(requirement.toolKey)
	return minimumStacks > 1 ? `${name} ${minimumStacks}` : name
}
