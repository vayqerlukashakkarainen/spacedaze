const MAX_CHANCE = 0.35
const MIN_CHANCE = 0.1
const LEVEL_PENALTY = 0.03
const ELITE_CHANCE_MULTIPLIER = 0.65

export function getWakeEnemyMalfunctionChance(
	enemyLevel: number,
	elite: boolean
) {
	const normalChance = Math.min(
		MAX_CHANCE,
		Math.max(
			MIN_CHANCE,
			MAX_CHANCE - Math.max(0, enemyLevel - 2) * LEVEL_PENALTY
		)
	)
	return elite ? normalChance * ELITE_CHANCE_MULTIPLIER : normalChance
}
