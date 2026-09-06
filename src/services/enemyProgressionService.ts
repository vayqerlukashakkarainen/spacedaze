export const ENEMY_PROGRESSION = {
	"swarm-drone": { name: "SWARM DRONE", minRunDepth: 1, minHubLevel: 1 },
	fighter: { name: "FIGHTER", minRunDepth: 1, minHubLevel: 1 },
	assassin: { name: "ASSASSIN", minRunDepth: 1, minHubLevel: 1 },
	rammer: { name: "RAMMER", minRunDepth: 1, minHubLevel: 1 },
	sniper: { name: "SNIPER", minRunDepth: 1, minHubLevel: 1 },
	hivemind: { name: "HIVEMIND", minRunDepth: 1, minHubLevel: 1 },
	"mine-layer": { name: "MINE LAYER", minRunDepth: 1, minHubLevel: 1 },
	"shield-drone": { name: "SHIELD DRONE", minRunDepth: 1, minHubLevel: 1 },
	"orbit-lancer": { name: "ORBIT LANCER", minRunDepth: 3, minHubLevel: 1 },
	splitter: { name: "SPLITTER", minRunDepth: 1, minHubLevel: 1 },
	"siege-barge": { name: "SIEGE BARGE", minRunDepth: 1, minHubLevel: 1 },
	"tether-drone": { name: "TETHER DRONE", minRunDepth: 1, minHubLevel: 1 },
	"repair-skiff": { name: "REPAIR SKIFF", minRunDepth: 1, minHubLevel: 1 },
	"gravity-warden": { name: "GRAVITY WARDEN", minRunDepth: 1, minHubLevel: 1 },
	"phase-skirmisher": { name: "PHASE SKIRMISHER", minRunDepth: 1, minHubLevel: 1 },
	"salvage-scavenger": { name: "SALVAGE SCAVENGER", minRunDepth: 1, minHubLevel: 1 },
	suppressor: { name: "SUPPRESSOR", minRunDepth: 1, minHubLevel: 1 },
	"breach-crawler": { name: "BREACH CRAWLER", minRunDepth: 1, minHubLevel: 1 },
} as const

export type ProgressionEnemyId = keyof typeof ENEMY_PROGRESSION

export interface EnemyProgressionContext {
	runDepth: number
	hubLevel: number
}

export function isEnemyProgressionUnlocked(
	id: ProgressionEnemyId,
	context: EnemyProgressionContext
) {
	const requirement = ENEMY_PROGRESSION[id]
	return context.runDepth >= requirement.minRunDepth &&
		context.hubLevel >= requirement.minHubLevel
}

export function getEnemyProgressionRoster() {
	return Object.entries(ENEMY_PROGRESSION).map(([id, requirement]) => ({
		id: id as ProgressionEnemyId,
		...requirement,
	}))
}
