import { RewardRarity } from "../types/rewardTypes"

export type ChestOpeningMode = "challenge" | "direct"

// Temporary global swap for playtesting. Set this back to "challenge" to
// restore the existing minigames without removing their implementation.
export const CHEST_OPENING_MODE: ChestOpeningMode = "direct"

export const DIRECT_CHEST_SUCCESSFUL_HITS = 3
export const DIRECT_CHEST_FAILED_ATTEMPTS = 0

export interface DirectChestOpeningProfile {
	duration: number
	chargeScale: number
	rayCount: number
	rayLength: number
	particleRate: number
	burstParticleCount: number
	shake: number
	soundVolume: number
	soundDetune: number
	soundSpeed: number
}

const DIRECT_OPENING_PROFILES: Record<
	RewardRarity,
	DirectChestOpeningProfile
> = {
	[RewardRarity.Common]: profile(0.28, 1.08, 4, 78, 7, 24, 0.15, 0.26, -220, 1.35),
	[RewardRarity.Uncommon]: profile(0.4, 1.13, 6, 94, 11, 36, 0.45, 0.32, -80, 1.2),
	[RewardRarity.Rare]: profile(0.62, 1.2, 8, 116, 17, 54, 1.25, 0.4, 100, 1.02),
	[RewardRarity.Epic]: profile(0.92, 1.3, 12, 150, 26, 82, 2.8, 0.5, 280, 0.86),
	[RewardRarity.Legendary]: profile(1.3, 1.42, 16, 190, 38, 120, 5.5, 0.62, 520, 0.72),
}

export function getDirectChestOpeningProfile(rarity: RewardRarity) {
	return DIRECT_OPENING_PROFILES[rarity]
}

export function getHighestChestRewardRarity(
	rewards: readonly { rarity: RewardRarity }[]
) {
	let highest = RewardRarity.Common
	for (const reward of rewards) {
		if (rarityRank(reward.rarity) > rarityRank(highest)) {
			highest = reward.rarity
		}
	}
	return highest
}

function profile(
	duration: number,
	chargeScale: number,
	rayCount: number,
	rayLength: number,
	particleRate: number,
	burstParticleCount: number,
	shake: number,
	soundVolume: number,
	soundDetune: number,
	soundSpeed: number
): DirectChestOpeningProfile {
	return {
		duration,
		chargeScale,
		rayCount,
		rayLength,
		particleRate,
		burstParticleCount,
		shake,
		soundVolume,
		soundDetune,
		soundSpeed,
	}
}

function rarityRank(rarity: RewardRarity) {
	return Object.values(RewardRarity).indexOf(rarity)
}
