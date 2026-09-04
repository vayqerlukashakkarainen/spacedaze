import { UpgradeDefinition } from "../types/upgradeTypes";
import {
	blaster,
	blasterMultiple,
	blasterSpeed,
	blasterDmg,
	mouseAim,
} from "./blastersNew";
import { rocket, increaseRockets, rocketShards } from "./rocketsNew";
import {
	debreeDist,
	sprint,
	sprintSpeed,
	spaceJump,
	spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,
	movespeed,
	debreeValue,
	maxHealth,
} from "./shipNew";
import {
	followerBlasterDmg,
	followerGunship,
	followerInterceptorProtocol,
	followerMedic,
	followerMissiles,
	followerProjectileLink,
	followerSalvager,
} from "./followerNew";
import { RewardRarity, UpgradeRewardPolicy } from "../types/rewardTypes";
import {
	arcCapacitor,
	armorPiercing,
	criticalPayload,
	corrosivePayload,
	cryoRounds,
	kineticPulse,
	ricochetRounds,
	ricochetModifierLink,
	singularityPayload,
	splitChamber,
	targetingMatrix,
} from "./projectilesNew";
import {
	afterimageRounds,
	boomerangPayload,
	criticalShatter,
	executionRounds,
	fragmentationCore,
	growingCharge,
	hunterGuidance,
	mineLayer,
	momentumCore,
	orbitingRounds,
	proximityFuse,
	stasisBurst,
	targetPainter,
	voidLance,
	volatileCorrosion,
} from "./projectileBehaviorsNew"
import {
	afterburnerWake,
	enemyHacker,
	sacrificialProtocol,
	scrapArmor,
} from "./systemsNew"

const definitions: Record<string, UpgradeDefinition> = {
	// Blasters
	blaster,
	blasterParallel: blasterMultiple,
	blasterSpeed,
	blasterDmg,
	mouseAim,

	// Rockets
	rockets: rocket,
	nrOfRockets: increaseRockets,
	rocketShards,

	// Ship - Movement
	sprint,
	sprintSpeed,
	spaceJump,
	spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,
	movespeed,

	// Ship - Resources
	debreeDist,
	debreeValue,

	// Ship - Survival
	maxHealth,

	// Follower
	followerBlasterDmg,
	followerMissiles,
	followerProjectileLink,
	followerInterceptorProtocol,
	followerGunship,
	followerMedic,
	followerSalvager,
	scrapArmor,
	afterburnerWake,
	sacrificialProtocol,
	enemyHacker,

	// Projectile modifiers
	armorPiercing,
	cryoRounds,
	corrosivePayload,
	arcCapacitor,
	splitChamber,
	singularityPayload,
	targetingMatrix,
	criticalPayload,
	kineticPulse,
	ricochetRounds,
	ricochetModifierLink,
	fragmentationCore,
	hunterGuidance,
	proximityFuse,
	afterimageRounds,
	boomerangPayload,
	growingCharge,
	momentumCore,
	orbitingRounds,
	stasisBurst,
	volatileCorrosion,
	criticalShatter,
	executionRounds,
	targetPainter,
	mineLayer,
	voidLance,
};

const upgradeRewardPolicies: Record<string, UpgradeRewardPolicy> = {
	blaster: policy(RewardRarity.Rare, ["crate", "boss"], 70, 0, 180),
	blasterParallel: policy(RewardRarity.Rare, ["crate", "boss"], 80, 0, 140),
	blasterSpeed: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 30, 90),
	blasterDmg: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 120, 25, 100),
	mouseAim: policy(RewardRarity.Legendary, ["crate", "boss"], 20, 0, 180),
	rockets: policy(RewardRarity.Rare, ["crate", "boss"], 70, 0, 180),
	nrOfRockets: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 140, 35, 100),
	rocketShards: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 120, 30, 100),
	sprint: policy(RewardRarity.Uncommon, ["crate", "boss"], 100, 0, 100),
	sprintSpeed: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 25, 80),
	spaceJumpUpgrades: policy(RewardRarity.Rare, ["crate", "boss"], 70, 0, 130),
	phaseRam: policy(RewardRarity.Rare, ["crate", "boss"], 55, 0, 120),
	phaseMagazine: policy(RewardRarity.Epic, ["crate", "boss"], 24, 0, 145),
	movespeed: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 140, 35, 90),
	debreeDist: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 35, 80),
	debreeValue: policy(RewardRarity.Uncommon, ["crate", "boss"], 90, 0, 80),
	maxHealth: policy(RewardRarity.Rare, ["crate", "boss"], 80, 0, 130),
	followerBlasterDmg: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 110, 25, 100),
	followerMissiles: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 160),
	followerProjectileLink: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 150),
	followerInterceptorProtocol: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 130),
	followerGunship: policy(RewardRarity.Rare, ["crate", "boss"], 44, 0, 125),
	followerMedic: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 145),
	followerSalvager: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 72, 12, 90),
	scrapArmor: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 88, 16, 100),
	afterburnerWake: policy(RewardRarity.Rare, ["crate", "boss"], 46, 0, 115),
	sacrificialProtocol: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 145),
	enemyHacker: policy(RewardRarity.Epic, ["crate", "boss"], 18, 0, 135),
	armorPiercing: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 35, 90),
	cryoRounds: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 30, 80),
	corrosivePayload: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 100),
	arcCapacitor: policy(RewardRarity.Rare, ["crate", "boss"], 55, 0, 140),
	splitChamber: policy(RewardRarity.Rare, ["crate", "boss"], 45, 0, 130),
	singularityPayload: policy(RewardRarity.Epic, ["boss"], 0, 0, 180),
	targetingMatrix: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 125, 30, 90),
	criticalPayload: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 110),
	kineticPulse: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 110),
	ricochetRounds: policy(RewardRarity.Rare, ["crate", "enemy", "boss"], 70, 15, 125),
	ricochetModifierLink: policy(RewardRarity.Epic, ["crate", "boss"], 24, 0, 145),
	fragmentationCore: policy(RewardRarity.Rare, ["crate", "boss"], 52, 0, 120),
	hunterGuidance: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 90, 18, 95),
	proximityFuse: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 115),
	afterimageRounds: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 135),
	boomerangPayload: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 82, 14, 90),
	growingCharge: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 90, 18, 95),
	momentumCore: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 115, 24, 80),
	orbitingRounds: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 105),
	stasisBurst: policy(RewardRarity.Rare, ["crate", "boss"], 42, 0, 115),
	volatileCorrosion: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 135),
	criticalShatter: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 135),
	executionRounds: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 82, 15, 95),
	targetPainter: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 88, 16, 95),
	mineLayer: policy(RewardRarity.Rare, ["crate", "boss"], 44, 0, 110),
	voidLance: policy(RewardRarity.Epic, ["boss"], 0, 0, 150),
};

for (const [toolKey, reward] of Object.entries(upgradeRewardPolicies)) {
	if (definitions[toolKey]) definitions[toolKey].reward = reward;
}

export const upgradeRegistry = definitions;

function policy(
	rarity: RewardRarity,
	allowedSources: UpgradeRewardPolicy["allowedSources"],
	crate: number,
	enemy: number,
	boss: number
): UpgradeRewardPolicy {
	return {
		rarity,
		allowedSources,
		weights: {
			crate: crate || undefined,
			enemy: enemy || undefined,
			boss: boss || undefined,
		},
	};
}

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
