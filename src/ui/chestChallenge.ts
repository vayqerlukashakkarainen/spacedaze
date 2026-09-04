export type ChestChallengeType =
	| "linear"
	| "bezier"
	| "frequency"
	| "capacitor"

export type ChestRewardType = "salvage" | "weapon"

export interface ChestChallengeConfig {
	difficulty: number
	type: ChestChallengeType
	speed: number
	linearZoneWidth: number
	bezierHitWindow: number
	frequencyHitWindow: number
	frequencyTuneSpeed: number
	capacitorChargeSpeed: number
	capacitorMinimumCharge: number
	capacitorGoodCharge: number
	capacitorPerfectCharge: number
	maxPasses: number
}

let nextChestDifficulty = 1
let nextChestRewardType: ChestRewardType = "salvage"

export function setNextChestDifficulty(difficulty: number) {
	nextChestDifficulty = difficulty
}

export function setNextChestRewardType(type: ChestRewardType) {
	nextChestRewardType = type
}

export function consumeNextChestDifficulty() {
	const difficulty = nextChestDifficulty
	nextChestDifficulty = 1
	return difficulty
}

export function consumeNextChestRewardType() {
	const type = nextChestRewardType
	nextChestRewardType = "salvage"
	return type
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
		frequencyHitWindow: 0.16 - difficultyProgress * 0.07,
		frequencyTuneSpeed: 0.58 + difficultyProgress * 0.12,
		capacitorChargeSpeed: 0.42 + difficultyProgress * 0.08,
		capacitorMinimumCharge: 0.42 + difficultyProgress * 0.04,
		capacitorGoodCharge: 0.64 + difficultyProgress * 0.05,
		capacitorPerfectCharge: 0.82 + difficultyProgress * 0.06,
		maxPasses: type === "linear" ? 3 : 1,
	}
}

export function normalizeChestChallengeHits(
	type: ChestChallengeType,
	successfulHits: number
) {
	return type === "bezier" && successfulHits > 0 ? 3 : successfulHits
}
