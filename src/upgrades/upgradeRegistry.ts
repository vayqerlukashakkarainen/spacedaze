import { UpgradeDefinition } from "../types/upgradeTypes";
import {
	blaster,
	blasterMultiple,
	blasterSpeed,
} from "./blastersNew";
import {
	debreeDist,
	spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,
	movespeed,
	strafeSpeed,
	kineticCoupler,
	torqueSpool,
	shockCradle,
	momentumRelay,
	redlineCable,
	debreeValue,
	maxHealth,
	extraLife,
	turretTraverse,
	salvageLasso,
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
	componentShear,
	coreBreach,
	criticalPayload,
	corrosivePayload,
	cryoRounds,
	empRounds,
	stunRounds,
	kineticPulse,
	lifesteal,
	probabilityAmplifier,
	ricochetRounds,
	ricochetModifierLink,
	singularityPayload,
	splitChamber,
	targetingMatrix,
} from "./projectilesNew";
import {
	afterimageRounds,
	criticalShatter,
	executionRounds,
	fragmentationCore,
	growingCharge,
	hunterGuidance,
	mineLayer,
	proximityFuse,
	stasisBurst,
	targetPainter,
	voidLance,
	volatileCorrosion,
} from "./projectileBehaviorsNew"
import {
	afterburnerWake,
	droneFusion,
	enemyHacker,
	glassReactor,
	kineticRam,
	nearMissCapacitor,
	packIntelligence,
	phaseEcho,
	phaseWake,
	reactivePlating,
	sawSatellite,
	sacrificialProtocol,
	salvageBattery,
	scrapArmor,
} from "./systemsNew"
import {
	phaseCounter,
	resonanceCoil,
	tacticalUplink,
	threatReactor,
	wreckHarvester,
} from "./stackingRewardsNew"
import {
	arcHarpoonDefinition,
	graviticImpalerDefinition,
	huntersGeometryDefinition,
	shrapnelGardenDefinition,
} from "./alterations"

const definitions: Record<string, UpgradeDefinition> = {
	// Blasters
	blaster,
	blasterParallel: blasterMultiple,
	blasterSpeed,

	// Ship - Movement
	spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,
	movespeed,
	strafeSpeed,
	kineticCoupler,
	torqueSpool,
	shockCradle,
	momentumRelay,
	redlineCable,

	// Ship - Resources
	debreeDist,
	debreeValue,

	// Ship - Survival
	maxHealth,
	extraLife,
	turretTraverse,
	salvageLasso,

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
	phaseEcho,
	phaseWake,
	salvageBattery,
	reactivePlating,
	packIntelligence,
	glassReactor,
	droneFusion,
	sawSatellite,
	kineticRam,
	nearMissCapacitor,
	tacticalUplink,
	phaseCounter,
	threatReactor,
	resonanceCoil,
	wreckHarvester,

	// Projectile modifiers
	armorPiercing,
	componentShear,
	coreBreach,
	cryoRounds,
	empRounds,
	stunRounds,
	corrosivePayload,
	arcCapacitor,
	lifesteal,
	probabilityAmplifier,
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
	growingCharge,
	stasisBurst,
	volatileCorrosion,
	criticalShatter,
	executionRounds,
	targetPainter,
	mineLayer,
	voidLance,
	arcHarpoon: arcHarpoonDefinition,
	shrapnelGarden: shrapnelGardenDefinition,
	huntersGeometry: huntersGeometryDefinition,
	graviticImpaler: graviticImpalerDefinition,
};

const upgradeRewardPolicies: Record<string, UpgradeRewardPolicy> = {
	blaster: policy(RewardRarity.Legendary, ["crate", "boss"], 70, 0, 180),
	blasterSpeed: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 30, 90),
	spaceJumpUpgrades: policy(RewardRarity.Rare, ["crate", "boss"], 70, 0, 130),
	phaseRam: policy(RewardRarity.Rare, ["crate", "boss"], 55, 0, 120),
	phaseMagazine: policy(RewardRarity.Epic, ["crate", "boss"], 24, 0, 145, 3),
	movespeed: policy(RewardRarity.Common, [], 0, 0, 0),
	strafeSpeed: policy(RewardRarity.Common, [], 0, 0, 0),
	kineticCoupler: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 28, 88),
	torqueSpool: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 28, 88),
	shockCradle: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 88, 16, 96),
	momentumRelay: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 112, 2),
	redlineCable: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 138, 3),
	debreeDist: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 35, 80),
	debreeValue: policy(RewardRarity.Uncommon, ["crate", "boss"], 90, 0, 80),
	maxHealth: policy(RewardRarity.Rare, [], 0, 0, 0),
	salvageLasso: policy(RewardRarity.Legendary, [], 0, 0, 0, 2),
	turretTraverse: policy(RewardRarity.Legendary, [], 0, 0, 0),
	followerBlasterDmg: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 110, 25, 100),
	followerMissiles: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 160, 2),
	followerProjectileLink: policy(RewardRarity.Legendary, ["crate", "boss"], 20, 0, 150, 2),
	followerInterceptorProtocol: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 130),
	followerGunship: policy(RewardRarity.Rare, ["crate", "boss"], 44, 0, 125),
	followerMedic: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 145, 2),
	followerSalvager: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 72, 12, 90),
	scrapArmor: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 88, 16, 100),
	afterburnerWake: policy(RewardRarity.Rare, ["crate", "boss"], 46, 0, 115),
	sacrificialProtocol: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 145, 4),
	enemyHacker: policy(RewardRarity.Epic, ["crate", "boss"], 18, 0, 135, 5),
	phaseEcho: policy(RewardRarity.Rare, ["crate", "boss"], 42, 0, 118, 3),
	phaseWake: policy(RewardRarity.Rare, ["crate", "boss"], 44, 0, 120, 2),
	salvageBattery: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 76, 14, 92, 2),
	reactivePlating: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 112, 2),
	packIntelligence: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 132, 4),
	glassReactor: policy(RewardRarity.Legendary, ["crate", "boss"], 4, 0, 42, 5),
	droneFusion: policy(RewardRarity.Legendary, ["crate", "boss"], 10, 0, 62, 5),
	sawSatellite: policy(RewardRarity.Rare, ["crate", "boss"], 42, 0, 115, 2),
	kineticRam: policy(RewardRarity.Rare, ["crate", "boss"], 42, 0, 118, 3),
	nearMissCapacitor: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 132, 4),
	tacticalUplink: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 105, 20, 95),
	phaseCounter: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 120, 2),
	threatReactor: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 130, 3),
	resonanceCoil: policy(RewardRarity.Rare, ["crate", "boss"], 45, 0, 120, 2),
	wreckHarvester: policy(RewardRarity.Legendary, ["crate", "boss"], 8, 0, 55, 4),
	armorPiercing: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 130, 35, 90),
	componentShear: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 30, 85),
	coreBreach: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 30, 85),
	cryoRounds: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 120, 30, 80),
	empRounds: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 90, 20, 95),
	stunRounds: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 110, 25, 80),
	corrosivePayload: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 100),
	arcCapacitor: policy(RewardRarity.Rare, ["crate", "boss"], 55, 0, 140),
	lifesteal: policy(RewardRarity.Rare, ["crate", "boss"], 52, 0, 135, 2),
	probabilityAmplifier: policy(RewardRarity.Legendary, ["crate", "boss"], 8, 0, 55, 4),
	splitChamber: policy(RewardRarity.Rare, ["crate", "boss"], 45, 0, 130),
	singularityPayload: policy(RewardRarity.Epic, ["crate", "boss"], 12, 0, 180, 4),
	targetingMatrix: policy(RewardRarity.Common, ["crate", "enemy", "boss"], 125, 30, 90),
	criticalPayload: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 110),
	kineticPulse: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 100, 20, 110),
	ricochetRounds: policy(RewardRarity.Rare, ["crate", "enemy", "boss"], 70, 15, 125),
	ricochetModifierLink: policy(RewardRarity.Epic, ["crate", "boss"], 24, 0, 145, 3),
	fragmentationCore: policy(RewardRarity.Rare, ["crate", "boss"], 52, 0, 120),
	hunterGuidance: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 90, 18, 95),
	proximityFuse: policy(RewardRarity.Rare, ["crate", "boss"], 48, 0, 115),
	afterimageRounds: policy(RewardRarity.Epic, ["crate", "boss"], 22, 0, 135, 3),
	growingCharge: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 90, 18, 95),
	stasisBurst: policy(RewardRarity.Rare, ["crate", "boss"], 42, 0, 115),
	volatileCorrosion: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 135, 4),
	criticalShatter: policy(RewardRarity.Epic, ["crate", "boss"], 20, 0, 135, 4),
	executionRounds: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 82, 15, 95),
	targetPainter: policy(RewardRarity.Uncommon, ["crate", "enemy", "boss"], 88, 16, 95),
	mineLayer: policy(RewardRarity.Rare, ["crate", "boss"], 44, 0, 110, 3),
	voidLance: policy(RewardRarity.Epic, ["crate", "boss"], 10, 0, 150, 5),
	arcHarpoon: policy(RewardRarity.Legendary, ["crate", "boss"], 12, 0, 105, 2),
	shrapnelGarden: policy(RewardRarity.Legendary, ["crate", "boss"], 12, 0, 105, 2),
	huntersGeometry: policy(RewardRarity.Legendary, ["crate", "boss"], 12, 0, 105, 2),
	graviticImpaler: policy(RewardRarity.Legendary, ["crate", "boss"], 12, 0, 105, 2),
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
	boss: number,
	minimumHubLevel: number = 1
): UpgradeRewardPolicy {
	return {
		rarity,
		allowedSources,
		weights: {
			crate: crate || undefined,
			enemy: enemy || undefined,
			boss: boss || undefined,
		},
		minimumHubLevel,
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
