export const MAX_SHRINE_LEVEL = 5

export interface ShrineLevelConfig {
	level: number
	radius: number
	captureTime: number
	enemySpawnDelay: number
	enemySpawnInterval: number
	enemySpawnDistance: number
	enemySpawnSpacing: number
}

export function getShrineLevelConfig(
	runDepth: number,
	hexSize: number
): ShrineLevelConfig {
	const level = Math.min(
		MAX_SHRINE_LEVEL,
		Math.max(1, Math.floor(runDepth))
	)
	const levelProgress = (level - 1) / (MAX_SHRINE_LEVEL - 1)
	const radius = hexSize * lerp(1.9, 1.3, levelProgress)

	return {
		level,
		radius,
		captureTime: 5 + (level - 1) * 2,
		enemySpawnDelay: 1.5,
		enemySpawnInterval: lerp(5, 3.5, levelProgress),
		enemySpawnDistance: radius + hexSize * 2.5,
		enemySpawnSpacing: hexSize,
	}
}

function lerp(from: number, to: number, progress: number) {
	return from + (to - from) * progress
}
