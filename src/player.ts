import { escape } from "querystring";
import { getToolUpgradeLvlValue, ToolKey } from "./upg";

interface Ship {
	speed: number;
	speedMultiplier: number;
	speedPwrUpMultiplier: number;

	canSprint: number | undefined;
	sprintSpeedMultiplier: number;

	maxHealth: number;
	scorePerPickup: number;
	blasterDmg: number;
	blasterDmgMultiplier: number;
	blasterSpeedMultiplier: number;

	debreePickupDistance: number;
	debreeSeekDistance: number;
	debreeSeekDistanceMultiplier: number;
	debreeSeekSpeed: number;
	debreeSeekSpeedMultiplier: number;
	debreeValueMultiplier: number;

	blasterLvl: number | undefined;
	blasterParallel: number | undefined;
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
	followerCanUseMissiles: number | undefined;

	critChance: number;
	critMultiplier: number;
}

interface Session {
	extraHealth: number;
	extraRockets: number;
	extraSpaceDebreeInMissiles: number;
}

export const session: Session = {
	extraHealth: 0,
	extraRockets: 0,
	extraSpaceDebreeInMissiles: 0,
};

export function resetSession() {
	session.extraHealth = 0;
	session.extraRockets = 0;
	session.extraSpaceDebreeInMissiles = 0;
}

export const player: Ship = {
	maxHealth: 2,
	scorePerPickup: 1,
	blasterDmg: 2,
	blasterDmgMultiplier: 1,
	blasterLvl: undefined,
	blasterParallel: undefined,
	rocketsLvl: undefined,
	nrOfRockets: 3,
	rocketShards: 0,
	blasterSpeedMultiplier: 1,
	debreePickupDistance: 10,
	debreeSeekDistance: 50,
	debreeSeekSpeed: 80,
	debreeSeekDistanceMultiplier: 1,
	debreeSeekSpeedMultiplier: 1,
	debreeValueMultiplier: 1,
	rocketImpactDmg: 10,
	rocketSplashDmg: 5,
	rocketDmgMultiplier: 1,
	rocketSplashSize: 30,
	rocketSplashSizeMultiplier: 1,
	rocketSplashDmgFallOverDistance: 0.7, // How much the splash dmg is reduced after distance met
	rocketSplashDmgFallDistanceValue: 0.6,
	rocketSeekDistance: 200,
	speed: 100,
	canSprint: undefined,
	sprintSpeedMultiplier: 1,
	speedMultiplier: 1,
	speedPwrUpMultiplier: 1,
	followerBlasterDmg: 1,
	followerBlasterDmgMultiplier: 1,
	followerCanUseMissiles: undefined,
	critChance: 30,
	critMultiplier: 1.5,
};

export function loadPlayer() {
	player.blasterLvl = getToolUpgradeLvlValue("blaster");
	player.blasterParallel = getToolUpgradeLvlValue("blasterParallel");
	player.blasterDmgMultiplier = getToolUpgradeLvlValue("blasterDmg") ?? 1;
	player.blasterSpeedMultiplier = getToolUpgradeLvlValue("blasterSpeed") ?? 1;

	player.rocketsLvl = getToolUpgradeLvlValue("rockets");
	player.nrOfRockets = getToolUpgradeLvlValue("nrOfRockets") ?? 3;
	player.rocketShards = getToolUpgradeLvlValue("rocketShards") ?? 0;

	player.debreeSeekDistanceMultiplier =
		getToolUpgradeLvlValue("debreeDist") ?? 1;
	player.debreeSeekSpeedMultiplier = getToolUpgradeLvlValue("debreeSpeed") ?? 1;
	player.debreeValueMultiplier = getToolUpgradeLvlValue("debreeValue") ?? 1;

	player.canSprint = getToolUpgradeLvlValue("sprint");
	player.sprintSpeedMultiplier = getToolUpgradeLvlValue("sprintSpeed") ?? 1;

	player.speedMultiplier = getToolUpgradeLvlValue("movespeed") ?? 1;
	player.maxHealth = getToolUpgradeLvlValue("maxHealth") ?? 2;

	player.followerBlasterDmg = getToolUpgradeLvlValue("followerBlasterDmg") ?? 1;
	player.followerCanUseMissiles = getToolUpgradeLvlValue("followerMissiles");
}

export function hasLvlValue(value: number | undefined, lvl: number) {
	if (value === undefined) return false;

	return value >= lvl;
}
