import {
	Reward,
	RewardRarity,
	rollCrateReward,
	rollCrateRewardChoices,
	rollWeaponChestRewardChoices,
} from "./services/rewardService"

export { RewardRarity as Rarity }
export type ChestReward = Reward

export function generateChestReward(
	successfulHits: number
): ChestReward | undefined {
	return rollCrateReward(successfulHits)
}

export function generateWeaponChestRewardChoices(
	successfulHits: number,
	failedAttempts: number,
	excludedRewardIds: readonly string[] = []
) {
	return rollWeaponChestRewardChoices(
		successfulHits,
		failedAttempts,
		excludedRewardIds
	)
}

export function generateChestRewardChoices(
	successfulHits: number,
	failedAttempts: number,
	excludedRewardIds: readonly string[] = []
) {
	return rollCrateRewardChoices(
		successfulHits,
		failedAttempts,
		excludedRewardIds
	)
}
