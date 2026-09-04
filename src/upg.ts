import {
	blaster,
	blasterDmg,
	blasterMultiple,
	blasterSpeed,
	mouseAim,
} from "./upgrades/blasters";
import {
	followerBlasterDmg,
	followerGunship,
	followerInterceptorProtocol,
	followerMedic,
	followerMissiles,
	followerProjectileLink,
	followerSalvager,
} from "./upgrades/follower";
import { increaseRockets, rocket, rocketShards } from "./upgrades/rockets";
import {
	debreeDist,
	debreeValue,
	maxHealth,
	movespeed,
	sprint,
	sprintSpeed,
	spaceJump,
	spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,
} from "./upgrades/ship";
import { saveGame } from "./util";
import { upgradeService } from "./services/upgradeService";
import { getUpgradeDefinition } from "./upgrades/upgradeRegistry";
import type {
	UpgradeDefinition,
	UpgradeRequirements,
} from "./types/upgradeTypes";
import {
	describeRequirements,
	evaluateRequirements,
} from "./services/upgradeRequirementService";
import { RewardRarity } from "./types/rewardTypes";
import { getEquippedMobilityAbilityId } from "./services/abilityLoadoutService";
import {
	getHigherRarity,
	scaleUpgradeEffects,
} from "./services/rewardQualityService";
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
} from "./upgrades/projectilesNew";
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
} from "./upgrades/projectileBehaviorsNew"
import {
	afterburnerWake,
	enemyHacker,
	glassReactor,
	packIntelligence,
	phaseEcho,
	reactivePlating,
	sacrificialProtocol,
	salvageBattery,
	scrapArmor,
} from "./upgrades/systems"

interface Upgrade {
	name: string;
	desc: string;
	price: number;
	sprite: string;
	value: number;
}

export type ToolKey = keyof typeof upgrades;

export const PERMANENT_UPGRADE_KEYS = [
	"blaster",
	"blasterParallel",
	"debreeDist",
	"maxHealth",
	"mouseAim",
] as const;
export type PermanentUpgradeKey = typeof PERMANENT_UPGRADE_KEYS[number];

export interface Tool {
	toolName: string;
	requirements?: UpgradeRequirements;
	upgrades: Upgrade[];
}

export const upgrades = {
	blaster: blaster,
	blasterParallel: blasterMultiple,
	blasterDmg: blasterDmg,
	blasterSpeed: blasterSpeed,
	mouseAim: mouseAim,

	rockets: rocket,
	nrOfRockets: increaseRockets,
	rocketShards: rocketShards,

	debreeDist: debreeDist,
	debreeValue: debreeValue,

	sprint: sprint,
	sprintSpeed: sprintSpeed,
	spaceJump: spaceJump,
	spaceJumpUpgrades: spaceJumpUpgrades,
	phaseRam,
	phaseMagazine,

	movespeed: movespeed,
	maxHealth: maxHealth,

	followerBlasterDmg: followerBlasterDmg,
	followerMissiles: followerMissiles,
	followerProjectileLink: followerProjectileLink,
	followerInterceptorProtocol: followerInterceptorProtocol,
	followerGunship,
	followerMedic,
	followerSalvager,
	scrapArmor,
	afterburnerWake,
	sacrificialProtocol,
	enemyHacker,
	phaseEcho,
	salvageBattery,
	reactivePlating,
	packIntelligence,
	glassReactor,

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
} as const;

export let loadout: Record<ToolKey, number | undefined> = {
	blaster: undefined,
	blasterDmg: undefined,
	blasterSpeed: undefined,
	rockets: undefined,
	debreeDist: undefined,
	nrOfRockets: undefined,
	sprint: undefined,
	movespeed: undefined,
	debreeValue: undefined,
	maxHealth: undefined,
	followerBlasterDmg: undefined,
	followerMissiles: undefined,
	followerProjectileLink: undefined,
	followerInterceptorProtocol: undefined,
	followerGunship: undefined,
	followerMedic: undefined,
	followerSalvager: undefined,
	scrapArmor: undefined,
	afterburnerWake: undefined,
	sacrificialProtocol: undefined,
	enemyHacker: undefined,
	phaseEcho: undefined,
	salvageBattery: undefined,
	reactivePlating: undefined,
	packIntelligence: undefined,
	glassReactor: undefined,
	rocketShards: undefined,
	sprintSpeed: undefined,
	spaceJump: undefined,
	spaceJumpUpgrades: undefined,
	phaseRam: undefined,
	phaseMagazine: undefined,
	blasterParallel: undefined,
	mouseAim: undefined,
	armorPiercing: undefined,
	cryoRounds: undefined,
	corrosivePayload: undefined,
	arcCapacitor: undefined,
	splitChamber: undefined,
	singularityPayload: undefined,
	targetingMatrix: undefined,
	criticalPayload: undefined,
	kineticPulse: undefined,
	ricochetRounds: undefined,
	ricochetModifierLink: undefined,
	fragmentationCore: undefined,
	hunterGuidance: undefined,
	proximityFuse: undefined,
	afterimageRounds: undefined,
	boomerangPayload: undefined,
	growingCharge: undefined,
	momentumCore: undefined,
	orbitingRounds: undefined,
	stasisBurst: undefined,
	volatileCorrosion: undefined,
	criticalShatter: undefined,
	executionRounds: undefined,
	targetPainter: undefined,
	mineLayer: undefined,
	voidLance: undefined,
};

export let levelLoadout: Record<ToolKey, number | undefined> = {
	blaster: undefined,
	blasterDmg: undefined,
	blasterSpeed: undefined,
	rockets: undefined,
	debreeDist: undefined,
	nrOfRockets: undefined,
	sprint: undefined,
	movespeed: undefined,
	debreeValue: undefined,
	maxHealth: undefined,
	followerBlasterDmg: undefined,
	followerMissiles: undefined,
	followerProjectileLink: undefined,
	followerInterceptorProtocol: undefined,
	followerGunship: undefined,
	followerMedic: undefined,
	followerSalvager: undefined,
	scrapArmor: undefined,
	afterburnerWake: undefined,
	sacrificialProtocol: undefined,
	enemyHacker: undefined,
	phaseEcho: undefined,
	salvageBattery: undefined,
	reactivePlating: undefined,
	packIntelligence: undefined,
	glassReactor: undefined,
	rocketShards: undefined,
	sprintSpeed: undefined,
	spaceJump: undefined,
	spaceJumpUpgrades: undefined,
	phaseRam: undefined,
	phaseMagazine: undefined,
	blasterParallel: undefined,
	mouseAim: undefined,
	armorPiercing: undefined,
	cryoRounds: undefined,
	corrosivePayload: undefined,
	arcCapacitor: undefined,
	splitChamber: undefined,
	singularityPayload: undefined,
	targetingMatrix: undefined,
	criticalPayload: undefined,
	kineticPulse: undefined,
	ricochetRounds: undefined,
	ricochetModifierLink: undefined,
	fragmentationCore: undefined,
	hunterGuidance: undefined,
	proximityFuse: undefined,
	afterimageRounds: undefined,
	boomerangPayload: undefined,
	growingCharge: undefined,
	momentumCore: undefined,
	orbitingRounds: undefined,
	stasisBurst: undefined,
	volatileCorrosion: undefined,
	criticalShatter: undefined,
	executionRounds: undefined,
	targetPainter: undefined,
	mineLayer: undefined,
	voidLance: undefined,
};

export let loadoutRarity: Partial<Record<ToolKey, RewardRarity>> = {};
export let levelLoadoutRarity: Partial<Record<ToolKey, RewardRarity>> = {};

export function getToolUpgradeLvlValue(key: ToolKey) {
	const level = getEffectiveUpgradeLevel(key);
	if (level === undefined || !Number.isInteger(level) || level < 0) {
		return undefined;
	}

	const definition = getUpgradeDefinition(key);
	const upgrade = definition?.levels[level];
	if (!upgrade) return undefined;
	const rarity = getEffectiveUpgradeRarity(key) ?? definition.reward?.rarity;
	const effects = rarity && definition.reward
		? scaleUpgradeEffects(upgrade.effects, definition.reward.rarity, rarity)
		: upgrade.effects;

	if (key === "blaster") {
		const blasterCount = effects.modifiers?.find(
			(modifier) => modifier.stat === "blasterCount"
		)?.value;
		return blasterCount === undefined ? undefined : blasterCount - 1;
	}

	const stat = playerStatByTool[key];
	if (stat) {
		const value = effects.modifiers?.find(
			(modifier) => modifier.stat === stat
		)?.value;
		return Number.isFinite(value) ? value : undefined;
	}

	if (effects.unlocks?.length || effects.abilities?.length) {
		return level + 1;
	}

	return undefined;
}

export function getToolUpgradeStatValue(
	key: ToolKey,
	stat: string
): number | undefined {
	const level = getEffectiveUpgradeLevel(key);
	if (level === undefined || !Number.isInteger(level) || level < 0) {
		return undefined;
	}

	const definition = getUpgradeDefinition(key);
	const levelEffects = definition?.levels[level]?.effects;
	if (!definition || !levelEffects) return undefined;
	const rarity = getEffectiveUpgradeRarity(key) ?? definition.reward?.rarity;
	const effects = rarity && definition.reward
		? scaleUpgradeEffects(levelEffects, definition.reward.rarity, rarity)
		: levelEffects;
	return effects.modifiers?.find(
		(modifier) => modifier.stat === stat
	)?.value;
}

const playerStatByTool: Partial<Record<ToolKey, string>> = {
	blasterDmg: "blasterDmgMultiplier",
	blasterSpeed: "blasterSpeedMultiplier",
	nrOfRockets: "rocketCount",
	rocketShards: "rocketShards",
	debreeDist: "debreeSeekDistanceMultiplier",
	debreeValue: "debreeValueMultiplier",
	sprint: "sprintSpeedMultiplier",
	sprintSpeed: "sprintSpeedMultiplier",
	movespeed: "speedMultiplier",
	phaseRam: "spaceJumpDamage",
	maxHealth: "maxHealth",
	followerBlasterDmg: "followerBlasterDmg",
	armorPiercing: "projectilePierces",
	cryoRounds: "projectileSlowPercentage",
	corrosivePayload: "projectileDotDamage",
	arcCapacitor: "projectileChainCount",
	splitChamber: "projectileSplitCount",
	singularityPayload: "projectileGravityStrength",
	targetingMatrix: "critChance",
	criticalPayload: "critMultiplier",
	kineticPulse: "explosionPulseStrength",
	ricochetRounds: "projectileBounceCount",
	fragmentationCore: "projectileFragmentCount",
	hunterGuidance: "projectileGuidance",
	proximityFuse: "projectileProximityRadius",
	afterimageRounds: "projectileEchoCount",
	boomerangPayload: "projectileReturnSpeed",
	growingCharge: "projectileGrowthDamage",
	momentumCore: "projectileAcceleration",
	orbitingRounds: "projectileOrbitRadius",
	stasisBurst: "projectileStasisRadius",
	volatileCorrosion: "projectileVolatileRadius",
	criticalShatter: "projectileCriticalShards",
	executionRounds: "projectileExecutionDamage",
	targetPainter: "projectilePaintDamage",
	mineLayer: "projectileMineDuration",
	voidLance: "projectilePhasePierces",
};

export function isToolKey(key: string): key is ToolKey {
	return key in upgrades;
}

export function getEffectiveUpgradeLevel(
	key: ToolKey
): number | undefined {
	const permanentLevel = isPermanentUpgradeKey(key) ? loadout[key] : undefined;
	return levelLoadout[key] ?? permanentLevel;
}

export function getPermanentUpgradeLevel(key: ToolKey): number | undefined {
	return isPermanentUpgradeKey(key) ? loadout[key] : undefined;
}

export function getEffectiveUpgradeRarity(
	key: ToolKey
): RewardRarity | undefined {
	if (isPermanentUpgradeKey(key) && loadout[key] !== undefined) {
		return RewardRarity.Legendary;
	}
	return levelLoadoutRarity[key];
}

export function isPermanentUpgradeKey(
	key: ToolKey
): key is PermanentUpgradeKey {
	return PERMANENT_UPGRADE_KEYS.includes(key as PermanentUpgradeKey);
}

export function evaluateUpgradeRequirements(
	definition: UpgradeDefinition,
	resolveLevel: (toolKey: string) => number | undefined = (toolKey) =>
		resolveUpgradeOrAbilityLevel(toolKey)
) {
	return evaluateRequirements(definition, resolveLevel, getUpgradeName);
}

function resolveUpgradeOrAbilityLevel(toolKey: string) {
	const mobilityAbilityId = getEquippedMobilityAbilityId();
	if (toolKey === "sprint" && mobilityAbilityId === "thrusterOverdrive") return 0;
	if (toolKey === "spaceJump" && mobilityAbilityId === "phaseJump") return 0;
	return isToolKey(toolKey) ? getEffectiveUpgradeLevel(toolKey) : undefined;
}

export function getUpgradeRequirementText(key: ToolKey): string | undefined {
	const definition = getUpgradeDefinition(key);
	if (!definition) return undefined;
	const evaluation = evaluateUpgradeRequirements(definition);
	return evaluation.met ? undefined : evaluation.unmet.join(", ");
}

export function describeUpgradeRequirements(
	definition: UpgradeDefinition
): string | undefined {
	return describeRequirements(definition, getUpgradeName);
}

function getUpgradeName(toolKey: string) {
	return getUpgradeDefinition(toolKey)?.toolName ?? toolKey;
}

export function getNextRunUpgradeLevel(key: ToolKey): number | undefined {
	const definition = getUpgradeDefinition(key);
	if (!definition) return undefined;
	if (!evaluateUpgradeRequirements(definition).met) return undefined;

	const currentLevel = getEffectiveUpgradeLevel(key) ?? -1;
	const nextLevel = currentLevel + 1;
	if (!definition.levels[nextLevel]) return undefined;
	return nextLevel;
}

export function grantRunUpgrade(
	key: ToolKey,
	rarity?: RewardRarity
): number | undefined {
	const nextLevel = getNextRunUpgradeLevel(key);
	if (nextLevel === undefined) return undefined;
	levelLoadout[key] = nextLevel;
	if (rarity) {
		levelLoadoutRarity[key] = getHigherRarity(
			levelLoadoutRarity[key],
			rarity
		);
	}
	return nextLevel;
}

export function addLvl(key: ToolKey, rarity?: RewardRarity) {
	if (!isPermanentUpgradeKey(key)) {
		return grantRunUpgrade(key, rarity);
	}
	const nextLvl = getNextLvl(key);
	const upgradeDef = getUpgradeDefinition(key);
	if (!upgradeDef?.levels[nextLvl]) return undefined;
	loadout[key] = nextLvl;
	const resolvedRarity = rarity ?? RewardRarity.Legendary;
	loadoutRarity[key] = getHigherRarity(
		loadoutRarity[key],
		resolvedRarity
	);

	// Apply upgrade through new system
	upgradeService.purchaseUpgrade(key, upgradeDef.levels[nextLvl].effects);

	saveGame("slot1");
	return nextLvl;
}

export function getNextLvl(key: ToolKey) {
	if (loadout[key] === undefined) return 0;
	return loadout[key] + 1;
}

export function setLoadout(set: Record<string, number | undefined>) {
	loadout = Object.fromEntries(
		(Object.keys(upgrades) as ToolKey[]).map((key) => [key, set[key]])
	) as Record<ToolKey, number | undefined>;
}

export function setLoadoutRarity(
	set: Partial<Record<string, RewardRarity>>
) {
	loadoutRarity = Object.fromEntries(
		(Object.keys(upgrades) as ToolKey[]).flatMap((key) => {
			const rarity = set[key];
			return rarity ? [[key, rarity]] : [];
		})
	) as Partial<Record<ToolKey, RewardRarity>>;
}

export function resetLevelLoadout() {
	levelLoadoutRarity = {};
	levelLoadout = {
		blaster: undefined,
		blasterDmg: undefined,
		blasterSpeed: undefined,
		rockets: undefined,
		debreeDist: undefined,
		nrOfRockets: undefined,
		sprint: undefined,
		movespeed: undefined,
		debreeValue: undefined,
		maxHealth: undefined,
		followerBlasterDmg: undefined,
		followerMissiles: undefined,
		followerProjectileLink: undefined,
		followerInterceptorProtocol: undefined,
		followerGunship: undefined,
		followerMedic: undefined,
		followerSalvager: undefined,
		scrapArmor: undefined,
		afterburnerWake: undefined,
		sacrificialProtocol: undefined,
		enemyHacker: undefined,
		phaseEcho: undefined,
		salvageBattery: undefined,
		reactivePlating: undefined,
		packIntelligence: undefined,
		glassReactor: undefined,
		rocketShards: undefined,
		sprintSpeed: undefined,
		spaceJump: undefined,
		spaceJumpUpgrades: undefined,
		phaseRam: undefined,
		phaseMagazine: undefined,
		blasterParallel: undefined,
		mouseAim: undefined,
		armorPiercing: undefined,
		cryoRounds: undefined,
		corrosivePayload: undefined,
		arcCapacitor: undefined,
		splitChamber: undefined,
		singularityPayload: undefined,
		targetingMatrix: undefined,
		criticalPayload: undefined,
		kineticPulse: undefined,
		ricochetRounds: undefined,
		ricochetModifierLink: undefined,
		fragmentationCore: undefined,
		hunterGuidance: undefined,
		proximityFuse: undefined,
		afterimageRounds: undefined,
		boomerangPayload: undefined,
		growingCharge: undefined,
		momentumCore: undefined,
		orbitingRounds: undefined,
		stasisBurst: undefined,
		volatileCorrosion: undefined,
		criticalShatter: undefined,
		executionRounds: undefined,
		targetPainter: undefined,
		mineLayer: undefined,
		voidLance: undefined,
	};
}

export function clearAllUpgrades() {
	const clearedUpgradeCount = (Object.keys(upgrades) as ToolKey[]).filter(
		(key) => loadout[key] !== undefined || levelLoadout[key] !== undefined
	).length

	setLoadout({})
	setLoadoutRarity({})
	resetLevelLoadout()
	upgradeService.reset()
	return clearedUpgradeCount
}
