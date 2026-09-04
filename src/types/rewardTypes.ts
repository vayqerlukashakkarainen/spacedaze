export type RewardSource = "crate" | "enemy" | "boss"
export type RewardKind =
	| "powerup"
	| "upgrade"
	| "weapon"
	| "item"
	| "activeModule"
	| "mobility"
	| "ultimate"

export enum RewardRarity {
	Common = "COMMON",
	Uncommon = "UNCOMMON",
	Rare = "RARE",
	Epic = "EPIC",
	Legendary = "LEGENDARY",
}

export type RewardPersistence = "run" | "permanent"
export type RewardRepeatability = "once" | "stack" | "replace"

export type RewardRarityBehavior =
	| {
		mode: "fixed"
		value: RewardRarity
	}
	| {
		mode: "scaling"
		min: RewardRarity
		max: RewardRarity
	}

export interface RewardProgression {
	persistence: RewardPersistence
	repeatability: RewardRepeatability
	rarity: RewardRarityBehavior
}

export interface UpgradeRewardPolicy {
	allowedSources: readonly RewardSource[]
	rarity: RewardRarity
	weights: Partial<Record<RewardSource, number>>
	minimumHubLevel?: number
}
