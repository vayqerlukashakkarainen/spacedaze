export type RewardSource = "crate" | "enemy" | "boss"
export type RewardKind = "powerup" | "upgrade" | "item"

export enum RewardRarity {
	Common = "COMMON",
	Uncommon = "UNCOMMON",
	Rare = "RARE",
	Epic = "EPIC",
}

export interface UpgradeRewardPolicy {
	allowedSources: readonly RewardSource[]
	rarity: RewardRarity
	weights: Partial<Record<RewardSource, number>>
}
