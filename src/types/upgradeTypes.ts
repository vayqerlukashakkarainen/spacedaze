// Core upgrade system types

import { UpgradeRewardPolicy } from "./rewardTypes";

export type StatCategory =
	| "movement"
	| "combat"
	| "resources"
	| "survival"
	| "special";

export type UpgradeType =
	| "stat" // Modifies a stat value
	| "unlock" // Unlocks a feature/ability
	| "ability" // Grants active ability
	| "passive"; // Passive effect

export type ModifierType =
	| "base" // Sets base value
	| "additive" // Adds to base
	| "multiply" // Multiplies current value
	| "temporary"; // Temporary modifier (powerups)

export interface StatModifier {
	stat: string;
	value: number;
	type: ModifierType;
	duration?: number; // For temporary modifiers (in seconds)
}

export interface UnlockEffect {
	unlockId: string;
	description: string;
}

export interface AbilityEffect {
	abilityId: string;
	description: string;
	cooldown?: number;
}

export interface UpgradeEffect {
	modifiers?: StatModifier[];
	unlocks?: UnlockEffect[];
	abilities?: AbilityEffect[];
}

export interface UpgradeLevel {
	name: string;
	desc: string;
	price: number;
	sprite: string;
	effects: UpgradeEffect;
}

export interface UpgradeRequirement {
	toolKey: string;
	minimumStacks?: number;
}

export interface UpgradeRequirements {
	allOf?: readonly UpgradeRequirement[];
	anyOf?: readonly UpgradeRequirement[];
}

export interface UpgradeDefinition {
	toolKey: string;
	toolName: string;
	category: StatCategory;
	type: UpgradeType;
	requirements?: UpgradeRequirements;
	reward?: UpgradeRewardPolicy;
	levels: UpgradeLevel[];
}

// Runtime state interfaces

export interface ActiveModifier {
	id: string;
	stat: string;
	value: number;
	type: ModifierType;
	expiresAt?: number; // Timestamp for temporary modifiers
	source: string; // Where this modifier came from
}

export interface UnlockState {
	unlockId: string;
	unlockedAt: number; // Timestamp
	source: string;
}

export interface StatValue {
	base: number;
	final: number;
	modifiers: ActiveModifier[];
}

export interface UpgradeServiceState {
	purchasedUpgrades: Record<string, number>; // toolKey -> level index
	activeModifiers: ActiveModifier[];
	unlocks: UnlockState[];
	stats: Record<string, StatValue>;
}
