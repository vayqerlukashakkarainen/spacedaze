export type RewardSource = "crate" | "enemy" | "boss"
export type RewardKind = "powerup" | "upgrade" | "weapon" | "item"

export enum RewardRarity {
	Common = "COMMON",
	Uncommon = "UNCOMMON",
	Rare = "RARE",
	Epic = "EPIC",
	Legendary = "LEGENDARY",
}

export interface UpgradeRewardPolicy {
	allowedSources: readonly RewardSource[]
	rarity: RewardRarity
	weights: Partial<Record<RewardSource, number>>
}
