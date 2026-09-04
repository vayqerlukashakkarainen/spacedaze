export type EnemyRole = "pressure" | "artillery" | "support" | "controller" | "swarm" | "terrain"

export type BudgetEnemyId =
	| "rammer"
	| "orbit-lancer"
	| "splitter"
	| "phase-skirmisher"
	| "salvage-scavenger"
	| "siege-barge"
	| "tether-drone"
	| "repair-skiff"
	| "suppressor"
	| "gravity-warden"
	| "breach-crawler"

interface BudgetEnemyDefinition {
	id: BudgetEnemyId
	cost: number
	minThreat: number
	roles: EnemyRole[]
	maxPerEncounter?: number
}

export interface BudgetEncounterEntry {
	id: BudgetEnemyId
	cost: number
	roles: EnemyRole[]
}

const DEFINITIONS: readonly BudgetEnemyDefinition[] = [
	{ id: "rammer", cost: 2, minThreat: 2, roles: ["pressure"] },
	{ id: "orbit-lancer", cost: 2, minThreat: 1, roles: ["pressure"] },
	{ id: "splitter", cost: 3, minThreat: 2, roles: ["pressure"] },
	{ id: "phase-skirmisher", cost: 3, minThreat: 3, roles: ["pressure"] },
	{ id: "salvage-scavenger", cost: 2, minThreat: 2, roles: ["pressure"] },
	{ id: "siege-barge", cost: 4, minThreat: 3, roles: ["artillery"], maxPerEncounter: 1 },
	{ id: "tether-drone", cost: 3, minThreat: 3, roles: ["controller"], maxPerEncounter: 1 },
	{ id: "repair-skiff", cost: 3, minThreat: 3, roles: ["support"], maxPerEncounter: 1 },
	{ id: "suppressor", cost: 3, minThreat: 3, roles: ["controller"], maxPerEncounter: 1 },
	{ id: "gravity-warden", cost: 5, minThreat: 4, roles: ["controller"], maxPerEncounter: 1 },
	{ id: "breach-crawler", cost: 4, minThreat: 4, roles: ["terrain"], maxPerEncounter: 1 },
]

export function getEncounterBudget(threatTier: number) {
	return 5 + Math.max(1, Math.min(5, threatTier)) * 2
}

export function createBudgetEncounterPlan(
	threatTier: number,
	random: () => number = Math.random,
	allowTerrainEnemies: boolean = true
) {
	const tier = Math.max(1, Math.min(5, Math.round(threatTier)))
	const budget = getEncounterBudget(tier)
	const plan: BudgetEncounterEntry[] = []
	let remaining = budget
	const opener = pick(
		availableDefinitions(tier, remaining, plan, allowTerrainEnemies).filter((definition) => definition.roles.includes("pressure")),
		random
	)
	if (opener) {
		plan.push(toEntry(opener))
		remaining -= opener.cost
	}
	for (let attempt = 0; attempt < 24 && remaining >= 2; attempt++) {
		const selected = pick(availableDefinitions(tier, remaining, plan, allowTerrainEnemies), random)
		if (!selected) break
		plan.push(toEntry(selected))
		remaining -= selected.cost
	}
	return plan
}

function availableDefinitions(
	tier: number,
	remaining: number,
	plan: BudgetEncounterEntry[],
	allowTerrainEnemies: boolean
) {
	const controlCount = plan.filter((entry) => entry.roles.includes("controller")).length
	const supportCount = plan.filter((entry) => entry.roles.includes("support")).length
	return DEFINITIONS.filter((definition) => {
		if (!allowTerrainEnemies && definition.roles.includes("terrain")) return false
		if (definition.minThreat > tier || definition.cost > remaining) return false
		if (definition.maxPerEncounter !== undefined && plan.filter((entry) => entry.id === definition.id).length >= definition.maxPerEncounter) return false
		if (definition.roles.includes("controller") && controlCount >= 2) return false
		if (definition.roles.includes("support") && supportCount >= 1) return false
		return true
	})
}

function pick<T>(values: readonly T[], random: () => number) {
	if (values.length === 0) return undefined
	return values[Math.min(values.length - 1, Math.floor(random() * values.length))]
}

function toEntry(definition: BudgetEnemyDefinition): BudgetEncounterEntry {
	return { id: definition.id, cost: definition.cost, roles: [...definition.roles] }
}
