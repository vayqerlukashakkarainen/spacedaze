import {
	canCreateBudgetEncounter,
	createBudgetEncounterPlan,
} from "./enemyEncounterBudgetService"
import type { ProgressionEnemyId } from "./enemyProgressionService"

export type EncounterId =
	| "minor_swarm" | "patrol" | "hunters" | "rammers" | "mixed"
	| "sniper_nest" | "hivemind_swarm" | "mine_layer" | "elite_hunt"
	| "shielded_patrol" | "orbit_screen" | "splitter_pack" | "siege_line"
	| "tether_hunt" | "repair_column" | "gravity_lock" | "budgeted_response"

export interface EncounterDefinition {
	id: EncounterId
	minThreat: number
	weight: number
	enemies: readonly ProgressionEnemyId[]
}

export const ENCOUNTER_CATALOG: readonly EncounterDefinition[] = [
	{ id: "minor_swarm", minThreat: 1, weight: 6, enemies: ["swarm-drone"] },
	{ id: "patrol", minThreat: 2, weight: 5, enemies: ["fighter"] },
	{ id: "hunters", minThreat: 2, weight: 4, enemies: ["assassin"] },
	{ id: "rammers", minThreat: 2, weight: 3, enemies: ["rammer"] },
	{ id: "mixed", minThreat: 2, weight: 4, enemies: ["assassin", "fighter"] },
	{ id: "sniper_nest", minThreat: 2, weight: 3, enemies: ["sniper", "rammer"] },
	{ id: "hivemind_swarm", minThreat: 3, weight: 3, enemies: ["hivemind", "swarm-drone"] },
	{ id: "mine_layer", minThreat: 3, weight: 2, enemies: ["mine-layer", "assassin"] },
	{ id: "elite_hunt", minThreat: 4, weight: 2, enemies: ["assassin", "fighter"] },
	{ id: "shielded_patrol", minThreat: 4, weight: 2, enemies: ["sniper", "shield-drone", "rammer"] },
	{ id: "orbit_screen", minThreat: 1, weight: 4, enemies: ["orbit-lancer"] },
	{ id: "splitter_pack", minThreat: 2, weight: 3, enemies: ["splitter"] },
	{ id: "siege_line", minThreat: 3, weight: 2, enemies: ["siege-barge", "orbit-lancer"] },
	{ id: "tether_hunt", minThreat: 3, weight: 2, enemies: ["tether-drone", "rammer"] },
	{ id: "repair_column", minThreat: 3, weight: 2, enemies: ["siege-barge", "repair-skiff", "fighter"] },
	{ id: "gravity_lock", minThreat: 4, weight: 2, enemies: ["gravity-warden", "splitter"] },
	{ id: "budgeted_response", minThreat: 2, weight: 7, enemies: [] },
]

export function selectEncounterDefinition(
	tier: number,
	random: () => number,
	allowTerrainEnemies: boolean,
	isEnemyAvailable: (id: ProgressionEnemyId) => boolean
) {
	const candidates = ENCOUNTER_CATALOG.filter((definition) =>
		definition.minThreat <= tier &&
		definition.enemies.every(isEnemyAvailable) &&
		(definition.id !== "budgeted_response" || canCreateBudgetEncounter(
			tier,
			allowTerrainEnemies,
			isEnemyAvailable
		))
	)
	if (candidates.length === 0) return undefined
	let roll = random() * candidates.reduce((total, definition) => total + definition.weight, 0)
	for (const definition of candidates) {
		roll -= definition.weight
		if (roll <= 0) return definition
	}
	return candidates[candidates.length - 1]
}

export function createSimulatedEncounterEnemies(
	definition: EncounterDefinition,
	tier: number,
	random: () => number,
	isEnemyAvailable: (id: ProgressionEnemyId) => boolean
): ProgressionEnemyId[] {
	const scaled = (count: number) => Math.max(1, Math.round(count * (1 + (tier - 1) * 0.18)))
	if (definition.id === "budgeted_response") {
		return createBudgetEncounterPlan(tier, random, true, isEnemyAvailable).map((entry) => entry.id)
	}
	switch (definition.id) {
		case "minor_swarm": return Array.from({ length: 4 + Math.floor(random() * 7) }, () => "swarm-drone")
		case "hivemind_swarm": return ["hivemind", ...Array.from({ length: Math.max(11, scaled(11)) }, () => "swarm-drone" as const)]
		case "mixed": return Array.from({ length: scaled(3) }, (_, index) => index % 3 === 0 ? "assassin" : "fighter")
		case "sniper_nest": return ["sniper", ...Array.from({ length: scaled(2) }, () => "rammer" as const)]
		case "mine_layer": return ["mine-layer", ...Array.from({ length: scaled(2) }, () => "assassin" as const)]
		case "elite_hunt": return ["assassin", ...Array.from({ length: scaled(2) }, () => "fighter" as const)]
		case "shielded_patrol": return ["sniper", "shield-drone", ...Array.from({ length: scaled(2) }, () => "rammer" as const)]
		case "siege_line": return ["siege-barge", ...Array.from({ length: scaled(2) }, () => "orbit-lancer" as const)]
		case "tether_hunt": return ["tether-drone", ...Array.from({ length: scaled(2) }, () => "rammer" as const)]
		case "repair_column": return ["siege-barge", "repair-skiff", ...Array.from({ length: scaled(2) }, () => "fighter" as const)]
		case "gravity_lock": return ["gravity-warden", ...Array.from({ length: scaled(2) }, () => "splitter" as const)]
		default: return Array.from({ length: scaled(definition.id === "splitter_pack" ? 2 : definition.id === "hunters" || definition.id === "rammers" ? 2 : 3) }, () => definition.enemies[0])
	}
}
