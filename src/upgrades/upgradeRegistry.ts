import { UpgradeDefinition } from "../types/upgradeTypes";
import {
	blaster,
	blasterMultiple,
	blasterSpeed,
	blasterDmg,
} from "./blastersNew";
import { rocket, increaseRockets, rocketShards } from "./rocketsNew";
import {
	debreeDist,
	debreeSpeed,
	sprint,
	sprintSpeed,
	movespeed,
	debreeValue,
	maxHealth,
} from "./shipNew";
import { followerBlasterDmg, followerMissiles } from "./followerNew";

export const upgradeRegistry: Record<string, UpgradeDefinition> = {
	// Blasters
	blaster,
	blasterParallel: blasterMultiple,
	blasterSpeed,
	blasterDmg,

	// Rockets
	rockets: rocket,
	increaseRockets,
	rocketShards,

	// Ship - Movement
	sprint,
	sprintSpeed,
	movespeed,

	// Ship - Resources
	debreeDist,
	debreeSpeed,
	debreeValue,

	// Ship - Survival
	maxHealth,

	// Follower
	followerBlasterDmg,
	followerMissiles,
};

export function getUpgradeDefinition(
	toolKey: string
): UpgradeDefinition | undefined {
	return upgradeRegistry[toolKey];
}

export function getAllUpgradeDefinitions(): UpgradeDefinition[] {
	return Object.values(upgradeRegistry);
}

export function getUpgradesByCategory(category: string): UpgradeDefinition[] {
	return Object.values(upgradeRegistry).filter((u) => u.category === category);
}

export function getUpgradesByType(type: string): UpgradeDefinition[] {
	return Object.values(upgradeRegistry).filter((u) => u.type === type);
}
