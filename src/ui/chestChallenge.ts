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
	frequencyTimeLimit: number
	capacitorChargeSpeed: number
	capacitorMinimumCharge: number
	capacitorGoodCharge: number
	capacitorPerfectCharge: number
	capacitorPerfectMax: number
	capacitorTimeLimit: number
	capacitorChargeProfile: "steady" | "accelerating" | "surging"
	bezierSegmentCount: number
	maxPasses: number
}

export interface ChestChallengeVariationOptions {
	random?: () => number
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
	type: ChestChallengeType,
	options: ChestChallengeVariationOptions = {}
): ChestChallengeConfig {
	const clampedDifficulty = Math.min(5, Math.max(1, Math.round(difficulty)))
	const difficultyProgress = (clampedDifficulty - 1) / 4
	const random = options.random ?? Math.random
	const variation = random() * 2 - 1
	const capacitorCenter = clamp(
		0.8 + variation * 0.1,
		0.68,
		0.88
	)
	const capacitorPerfectWidth =
		0.11 - difficultyProgress * 0.055
	const capacitorPerfectCharge =
		capacitorCenter - capacitorPerfectWidth / 2
	const capacitorPerfectMax =
		capacitorCenter + capacitorPerfectWidth / 2
	const capacitorGoodWidth = 0.14 - difficultyProgress * 0.055
	const capacitorMinimumWidth = 0.18 - difficultyProgress * 0.065
	const profileRoll = random()
	const capacitorChargeProfile = profileRoll < 0.34
		? "steady" as const
		: profileRoll < 0.67
			? "accelerating" as const
			: "surging" as const
	const segmentMinimum = 2 + Math.floor(difficultyProgress * 2)
	const bezierSegmentCount = Math.min(
		6,
		segmentMinimum + Math.floor(random() * 3)
	)

	return {
		difficulty: clampedDifficulty,
		type,
		speed: type === "linear"
			? 0.82 + difficultyProgress * 0.6
			: 0.7 + difficultyProgress * 0.55,
		linearZoneWidth: 0.12 - difficultyProgress * 0.07,
		bezierHitWindow: 0.055 - difficultyProgress * 0.031,
		frequencyHitWindow: 0.12 - difficultyProgress * 0.075,
		frequencyTuneSpeed: 0.72 + difficultyProgress * 0.26,
		frequencyTimeLimit: 5.2 - difficultyProgress * 1.4,
		capacitorChargeSpeed:
			(0.58 + difficultyProgress * 0.24) * (1 + variation * 0.1),
		capacitorMinimumCharge: Math.max(
			0.2,
			capacitorPerfectCharge - capacitorGoodWidth - capacitorMinimumWidth
		),
		capacitorGoodCharge: capacitorPerfectCharge - capacitorGoodWidth,
		capacitorPerfectCharge,
		capacitorPerfectMax,
		capacitorTimeLimit: 4.4 - difficultyProgress * 0.9,
		capacitorChargeProfile,
		bezierSegmentCount,
		maxPasses: type === "linear" && clampedDifficulty <= 2 ? 2 : 1,
	}
}

export function normalizeChestChallengeHits(
	type: ChestChallengeType,
	successfulHits: number
) {
	return type === "bezier" && successfulHits > 0 ? 3 : successfulHits
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value))
}
