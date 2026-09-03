export type ChestChallengeType = "linear" | "bezier"

export interface ChestChallengeConfig {
	difficulty: number
	type: ChestChallengeType
	speed: number
	linearZoneWidth: number
	bezierHitWindow: number
	maxPasses: number
}

let nextChestDifficulty = 1

export function setNextChestDifficulty(difficulty: number) {
	nextChestDifficulty = difficulty
}

export function consumeNextChestDifficulty() {
	const difficulty = nextChestDifficulty
	nextChestDifficulty = 1
	return difficulty
}

export function createChestChallengeConfig(
	difficulty: number,
	type: ChestChallengeType
): ChestChallengeConfig {
	const clampedDifficulty = Math.min(5, Math.max(1, Math.round(difficulty)))
	const difficultyProgress = (clampedDifficulty - 1) / 4

	return {
		difficulty: clampedDifficulty,
		type,
		speed: type === "linear"
			? 0.62 + difficultyProgress * 0.42
			: 0.48 + difficultyProgress * 0.42,
		linearZoneWidth: 0.16 - difficultyProgress * 0.075,
		bezierHitWindow: 0.065 - difficultyProgress * 0.032,
		maxPasses: type === "linear" ? 3 : 1,
	}
}

export function normalizeChestChallengeHits(
	type: ChestChallengeType,
	successfulHits: number
) {
	return type === "bezier" && successfulHits > 0 ? 3 : successfulHits
}
