import { escape } from "querystring";
import {
	getToolUpgradeLvlValue,
	getToolUpgradeStatValue,
	getEffectiveUpgradeLevel,
	ToolKey,
} from "./upg";

interface Ship {
	speed: number;
	speedMultiplier: number;
	speedPwrUpMultiplier: number;

	canSprint: number | undefined;
	sprintSpeedMultiplier: number;
	spaceJumpLvl: number | undefined;
	spaceJumpUpgradeLvl: number | undefined;
	spaceJumpDamage: number;

	maxHealth: number;
	scorePerPickup: number;
	blasterDmg: number;
	blasterDmgMultiplier: number;
	blasterSpeedMultiplier: number;

	debreeSeekDistance: number;
	debreeSeekDistanceMultiplier: number;
	debreeValueMultiplier: number;

	blasterLvl: number | undefined;
	blasterParallel: number | undefined;
	mouseAim: number | undefined;
	rocketsLvl: number | undefined;

	rocketImpactDmg: number;
	rocketSplashDmg: number;
	rocketDmgMultiplier: number;
	rocketSeekDistance: number;

	rocketSplashSize: number;
	rocketSplashSizeMultiplier: number;

	rocketSplashDmgFallOverDistance: number;
	rocketSplashDmgFallDistanceValue: number;

	nrOfRockets: number;
	rocketShards: number;

	followerBlasterDmg: number;
	followerBlasterDmgMultiplier: number;
	missileDroneSlots: number;
	followerProjectileLink: number | undefined;
	followerInterceptorProtocol: number | undefined;
	gunshipDroneSlots: number;
	medicDroneSlots: number;
	salvagerDroneSlots: number;
	scrapArmor: number | undefined;
	afterburnerWake: number | undefined;
	sacrificialProtocol: number | undefined;
	enemyHacker: number | undefined;
	droneSetBonus: boolean;
	mobilitySetBonus: boolean;
	ordnanceSetBonus: boolean;
	salvageSetBonus: boolean;

	critChance: number;
	critMultiplier: number;
	explosionPulseStrength: number;

	projectilePierces: number;
	projectileSlowPercentage: number;
	projectileDotDamage: number;
	projectileChainCount: number;
	projectileSplitCount: number;
	projectileGravityStrength: number;
	projectileBounceCount: number;
	projectileBounceDamageRetention: number;
	ricochetInheritsModifiers: number | undefined;
	projectileFragmentCount: number;
	projectileFragmentDamage: number;
	projectileGuidance: number;
	projectileGuidanceDistance: number;
	projectileProximityRadius: number;
	projectileProximityDamage: number;
	projectileEchoCount: number;
	projectileEchoDamage: number;
	projectileReturnSpeed: number;
	projectileReturnDelay: number;
	projectileGrowthDamage: number;
	projectileGrowthScale: number;
	projectileAcceleration: number;
	projectileOrbitRadius: number;
	projectileStasisRadius: number;
	projectileVolatileRadius: number;
	projectileVolatileDamage: number;
	projectileCriticalShards: number;
	projectileCriticalShardDamage: number;
	projectileExecutionDamage: number;
	projectileExecutionThreshold: number;
	projectilePaintDamage: number;
	projectilePaintStacks: number;
	projectileMineDuration: number;
	projectileMineChance: number;
	projectileMineDamage: number;
	projectilePhasePierces: number;
}

interface Session {
	extraHealth: number;
	extraRockets: number;
	extraSpaceDebreeInMissiles: number;
	primaryRocketChance: number;
	scrapArmorCharges: number;
	scrapArmorProgress: number;
	volatileCargoActive: boolean;
	volatileCargoIntact: boolean;
	volatileCargoDelivered: boolean;
}

export const PLAYER_SCALE = 1.2;

export const session: Session = {
	extraHealth: 0,
	extraRockets: 0,
	extraSpaceDebreeInMissiles: 0,
	primaryRocketChance: 0,
	scrapArmorCharges: 0,
	scrapArmorProgress: 0,
	volatileCargoActive: false,
	volatileCargoIntact: false,
	volatileCargoDelivered: false,
};

export function resetSession() {
	session.extraHealth = 0;
	session.extraRockets = 0;
	session.extraSpaceDebreeInMissiles = 0;
	session.primaryRocketChance = 0;
	session.scrapArmorCharges = 0;
	session.scrapArmorProgress = 0;
	resetVolatileCargoObjective();
}

export function resetVolatileCargoObjective() {
	session.volatileCargoActive = false;
	session.volatileCargoIntact = false;
	session.volatileCargoDelivered = false;
}

export const player: Ship = {
	maxHealth: 2,
	scorePerPickup: 1,
	blasterDmg: 2,
	blasterDmgMultiplier: 1,
	blasterLvl: undefined,
	blasterParallel: undefined,
	mouseAim: undefined,
	rocketsLvl: undefined,
	nrOfRockets: 3,
	rocketShards: 0,
	blasterSpeedMultiplier: 1,
	debreeSeekDistance: 50,
	debreeSeekDistanceMultiplier: 1,
	debreeValueMultiplier: 1,
	rocketImpactDmg: 10,
	rocketSplashDmg: 5,
	rocketDmgMultiplier: 1,
	rocketSplashSize: 30,
	rocketSplashSizeMultiplier: 1,
	rocketSplashDmgFallOverDistance: 0.7, // How much the splash dmg is reduced after distance met
	rocketSplashDmgFallDistanceValue: 0.6,
	rocketSeekDistance: 200,
	speed: 130,
	canSprint: undefined,
	sprintSpeedMultiplier: 1,
	spaceJumpLvl: undefined,
	spaceJumpUpgradeLvl: undefined,
	spaceJumpDamage: 0,
	speedMultiplier: 1,
	speedPwrUpMultiplier: 1,
	followerBlasterDmg: 1,
	followerBlasterDmgMultiplier: 1,
	missileDroneSlots: 0,
	followerProjectileLink: undefined,
	followerInterceptorProtocol: undefined,
	gunshipDroneSlots: 0,
	medicDroneSlots: 0,
	salvagerDroneSlots: 0,
	scrapArmor: undefined,
	afterburnerWake: undefined,
	sacrificialProtocol: undefined,
	enemyHacker: undefined,
	droneSetBonus: false,
	mobilitySetBonus: false,
	ordnanceSetBonus: false,
	salvageSetBonus: false,
	critChance: 5,
	critMultiplier: 1.5,
	explosionPulseStrength: 0,
	projectilePierces: 0,
	projectileSlowPercentage: 0,
	projectileDotDamage: 0,
	projectileChainCount: 0,
	projectileSplitCount: 0,
	projectileGravityStrength: 0,
	projectileBounceCount: 0,
	projectileBounceDamageRetention: 0,
	ricochetInheritsModifiers: undefined,
	projectileFragmentCount: 0,
	projectileFragmentDamage: 0,
	projectileGuidance: 0,
	projectileGuidanceDistance: 0,
	projectileProximityRadius: 0,
	projectileProximityDamage: 0,
	projectileEchoCount: 0,
	projectileEchoDamage: 0,
	projectileReturnSpeed: 0,
	projectileReturnDelay: 0,
	projectileGrowthDamage: 0,
	projectileGrowthScale: 1,
	projectileAcceleration: 0,
	projectileOrbitRadius: 0,
	projectileStasisRadius: 0,
	projectileVolatileRadius: 0,
	projectileVolatileDamage: 0,
	projectileCriticalShards: 0,
	projectileCriticalShardDamage: 0,
	projectileExecutionDamage: 0,
	projectileExecutionThreshold: 0,
	projectilePaintDamage: 0,
	projectilePaintStacks: 0,
	projectileMineDuration: 0,
	projectileMineChance: 0,
	projectileMineDamage: 0,
	projectilePhasePierces: 0,
};

export function loadPlayer() {
	player.blasterLvl = getToolUpgradeLvlValue("blaster");
	player.blasterParallel = getToolUpgradeLvlValue("blasterParallel");
	player.mouseAim = getToolUpgradeLvlValue("mouseAim");
	player.blasterDmgMultiplier = getToolUpgradeLvlValue("blasterDmg") ?? 1;
	player.blasterSpeedMultiplier = getToolUpgradeLvlValue("blasterSpeed") ?? 1;

	player.rocketsLvl = getToolUpgradeLvlValue("rockets");
	player.nrOfRockets = getToolUpgradeLvlValue("nrOfRockets") ?? 3;
	player.rocketShards = getToolUpgradeLvlValue("rocketShards") ?? 0;

	player.debreeSeekDistanceMultiplier =
		getToolUpgradeLvlValue("debreeDist") ?? 1;
	player.debreeValueMultiplier = getToolUpgradeLvlValue("debreeValue") ?? 1;

	const overclockSpeedMultiplier = getToolUpgradeLvlValue("sprint");
	const coolingSpeedMultiplier = getToolUpgradeLvlValue("sprintSpeed") ?? 1;
	player.canSprint = overclockSpeedMultiplier === undefined ? undefined : 1;
	player.sprintSpeedMultiplier =
		(overclockSpeedMultiplier ?? 1) * coolingSpeedMultiplier;
	player.spaceJumpLvl = getToolUpgradeLvlValue("spaceJump");
	player.spaceJumpUpgradeLvl = getToolUpgradeLvlValue("spaceJumpUpgrades");
	player.spaceJumpDamage = getToolUpgradeLvlValue("phaseRam") ?? 0;

	player.speedMultiplier = getToolUpgradeLvlValue("movespeed") ?? 1;
	player.maxHealth = getToolUpgradeLvlValue("maxHealth") ?? 2;

	player.followerBlasterDmg = getToolUpgradeLvlValue("followerBlasterDmg") ?? 1;
	player.missileDroneSlots = getToolUpgradeLvlValue("followerMissiles") ?? 0;
	player.followerProjectileLink = getToolUpgradeLvlValue("followerProjectileLink");
	player.followerInterceptorProtocol = getToolUpgradeLvlValue(
		"followerInterceptorProtocol"
	);
	player.gunshipDroneSlots = getToolUpgradeLvlValue("followerGunship") ?? 0;
	player.medicDroneSlots = getToolUpgradeLvlValue("followerMedic") ?? 0;
	player.salvagerDroneSlots = getToolUpgradeLvlValue("followerSalvager") ?? 0;
	player.scrapArmor = getToolUpgradeLvlValue("scrapArmor");
	player.afterburnerWake = getToolUpgradeLvlValue("afterburnerWake");
	player.sacrificialProtocol = getToolUpgradeLvlValue("sacrificialProtocol");
	player.enemyHacker = getToolUpgradeLvlValue("enemyHacker");
	player.droneSetBonus = hasTechnologySet([
		"followerBlasterDmg",
		"followerMissiles",
		"followerProjectileLink",
		"followerInterceptorProtocol",
		"followerGunship",
		"followerMedic",
		"followerSalvager",
		"sacrificialProtocol",
		"enemyHacker",
	]);
	player.mobilitySetBonus = hasTechnologySet([
		"sprint",
		"sprintSpeed",
		"spaceJump",
		"spaceJumpUpgrades",
		"movespeed",
		"afterburnerWake",
	]);
	player.ordnanceSetBonus = hasTechnologySet([
		"blasterDmg",
		"blasterSpeed",
		"armorPiercing",
		"cryoRounds",
		"corrosivePayload",
		"arcCapacitor",
		"splitChamber",
		"ricochetRounds",
	]);
	player.salvageSetBonus = hasTechnologySet([
		"debreeDist",
		"debreeValue",
		"scrapArmor",
		"maxHealth",
	]);
	if (player.mobilitySetBonus) player.speedMultiplier *= 1.08;
	if (player.ordnanceSetBonus) {
		player.blasterDmgMultiplier *= 1.12;
		player.rocketDmgMultiplier = 1.12;
	} else {
		player.rocketDmgMultiplier = 1;
	}

	player.projectilePierces = getToolUpgradeLvlValue("armorPiercing") ?? 0;
	player.projectileSlowPercentage = getToolUpgradeLvlValue("cryoRounds") ?? 0;
	player.projectileDotDamage = getToolUpgradeLvlValue("corrosivePayload") ?? 0;
	player.projectileChainCount = getToolUpgradeLvlValue("arcCapacitor") ?? 0;
	player.projectileSplitCount = getToolUpgradeLvlValue("splitChamber") ?? 0;
	player.projectileGravityStrength =
		getToolUpgradeLvlValue("singularityPayload") ?? 0;
	player.projectileBounceCount =
		getToolUpgradeLvlValue("ricochetRounds") ?? 0;
	player.projectileBounceDamageRetention =
		getToolUpgradeStatValue(
			"ricochetRounds",
			"projectileBounceDamageRetention"
		) ?? 0;
	player.ricochetInheritsModifiers =
		getToolUpgradeLvlValue("ricochetModifierLink");
	player.critChance = getToolUpgradeLvlValue("targetingMatrix") ?? 5;
	player.critMultiplier = getToolUpgradeLvlValue("criticalPayload") ?? 1.5;
	player.explosionPulseStrength = getToolUpgradeLvlValue("kineticPulse") ?? 0;
	player.projectileFragmentCount =
		getToolUpgradeLvlValue("fragmentationCore") ?? 0;
	player.projectileFragmentDamage =
		getToolUpgradeStatValue(
			"fragmentationCore",
			"projectileFragmentDamage"
		) ?? 0;
	player.projectileGuidance = getToolUpgradeLvlValue("hunterGuidance") ?? 0;
	player.projectileGuidanceDistance =
		getToolUpgradeStatValue(
			"hunterGuidance",
			"projectileGuidanceDistance"
		) ?? 0;
	player.projectileProximityRadius =
		getToolUpgradeLvlValue("proximityFuse") ?? 0;
	player.projectileProximityDamage =
		getToolUpgradeStatValue("proximityFuse", "projectileProximityDamage") ?? 0;
	player.projectileEchoCount = getToolUpgradeLvlValue("afterimageRounds") ?? 0;
	player.projectileEchoDamage =
		getToolUpgradeStatValue("afterimageRounds", "projectileEchoDamage") ?? 0;
	player.projectileReturnSpeed = getToolUpgradeLvlValue("boomerangPayload") ?? 0;
	player.projectileReturnDelay =
		getToolUpgradeStatValue("boomerangPayload", "projectileReturnDelay") ?? 0;
	player.projectileGrowthDamage = getToolUpgradeLvlValue("growingCharge") ?? 0;
	player.projectileGrowthScale =
		getToolUpgradeStatValue("growingCharge", "projectileGrowthScale") ?? 1;
	player.projectileAcceleration = getToolUpgradeLvlValue("momentumCore") ?? 0;
	player.projectileOrbitRadius = getToolUpgradeLvlValue("orbitingRounds") ?? 0;
	player.projectileStasisRadius = getToolUpgradeLvlValue("stasisBurst") ?? 0;
	player.projectileVolatileRadius =
		getToolUpgradeLvlValue("volatileCorrosion") ?? 0;
	player.projectileVolatileDamage =
		getToolUpgradeStatValue(
			"volatileCorrosion",
			"projectileVolatileDamage"
		) ?? 0;
	player.projectileCriticalShards =
		getToolUpgradeLvlValue("criticalShatter") ?? 0;
	player.projectileCriticalShardDamage =
		getToolUpgradeStatValue(
			"criticalShatter",
			"projectileCriticalShardDamage"
		) ?? 0;
	player.projectileExecutionDamage =
		getToolUpgradeLvlValue("executionRounds") ?? 0;
	player.projectileExecutionThreshold =
		getToolUpgradeStatValue(
			"executionRounds",
			"projectileExecutionThreshold"
		) ?? 0;
	player.projectilePaintDamage = getToolUpgradeLvlValue("targetPainter") ?? 0;
	player.projectilePaintStacks =
		getToolUpgradeStatValue("targetPainter", "projectilePaintStacks") ?? 0;
	player.projectileMineDuration = getToolUpgradeLvlValue("mineLayer") ?? 0;
	player.projectileMineChance =
		getToolUpgradeStatValue("mineLayer", "projectileMineChance") ?? 0;
	player.projectileMineDamage =
		getToolUpgradeStatValue("mineLayer", "projectileMineDamage") ?? 0;
	player.projectilePhasePierces = getToolUpgradeLvlValue("voidLance") ?? 0;
}

export function addScrapArmorProgress(value: number) {
	if (player.scrapArmor === undefined || !Number.isFinite(value) || value <= 0) {
		return;
	}
	const maxCharges = player.salvageSetBonus ? 4 : 3;
	if (session.scrapArmorCharges >= maxCharges) return;
	session.scrapArmorProgress += value;
	while (
		session.scrapArmorProgress >= 8 &&
		session.scrapArmorCharges < maxCharges
	) {
		session.scrapArmorProgress -= 8;
		session.scrapArmorCharges++;
	}
}

export function getActiveTechnologySetNames() {
	const names: string[] = [];
	if (player.droneSetBonus) names.push("SWARM INTELLIGENCE");
	if (player.mobilitySetBonus) names.push("OVERDRIVE ARRAY");
	if (player.ordnanceSetBonus) names.push("MUNITIONS CASCADE");
	if (player.salvageSetBonus) names.push("SALVAGE ENGINE");
	return names;
}

function hasTechnologySet(keys: readonly ToolKey[]) {
	return keys.filter((key) => getEffectiveUpgradeLevel(key) !== undefined).length >= 3;
}

export function hasLvlValue(value: number | undefined, lvl: number) {
	if (value === undefined) return false;

	return value >= lvl;
}
