import {
	Reward,
	RewardRarity,
	rollCrateReward,
	rollCrateRewardChoices,
} from "./services/rewardService"

export { RewardRarity as Rarity }
export type ChestReward = Reward

export function generateChestReward(
	successfulHits: number
): ChestReward | undefined {
	return rollCrateReward(successfulHits)
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
