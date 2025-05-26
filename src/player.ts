import { getToolUpgradeLvlValue, ToolKey } from "./upg";

interface Ship {
	speed: number;
	speedMultiplier: number;
	speedPwrUpMultiplier: number;

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

	blasterLvl: number | undefined;
	rocketsLvl: number | undefined;

	rocketImpactDmg: number;
	rocketSplashDmg: number;
	rocketDmgMultiplier: number;
	rocketSeekDistance: number;

	rocketSplashSize: number;
	rocketSplashSizeMultiplier: number;

	rocketSplashDmgFallOverDistance: number;
	rocketSplashDmgFallDistanceValue: number;
}

export const player: Ship = {
	maxHealth: 10,
	scorePerPickup: 1,
	blasterDmg: 2,
	blasterDmgMultiplier: 1,
	blasterLvl: undefined,
	rocketsLvl: undefined,
	blasterSpeedMultiplier: 1,
	debreePickupDistance: 10,
	debreeSeekDistance: 50,
	debreeSeekSpeed: 80,
	debreeSeekDistanceMultiplier: 1,
	debreeSeekSpeedMultiplier: 1,
	rocketImpactDmg: 10,
	rocketSplashDmg: 5,
	rocketDmgMultiplier: 1,
	rocketSplashSize: 30,
	rocketSplashSizeMultiplier: 1,
	rocketSplashDmgFallOverDistance: 0.7, // How much the splash dmg is reduced after distance met
	rocketSplashDmgFallDistanceValue: 0.6,
	rocketSeekDistance: 200,
	speed: 100,
	speedMultiplier: 1,
	speedPwrUpMultiplier: 1,
};

export function loadPlayer() {
	player.blasterLvl = getToolUpgradeLvlValue("blaster");
	player.blasterDmgMultiplier = getToolUpgradeLvlValue("blasterDmg") ?? 1;
	player.blasterSpeedMultiplier = getToolUpgradeLvlValue("blasterSpeed") ?? 1;
	player.debreeSeekDistanceMultiplier =
		getToolUpgradeLvlValue("debreeDist") ?? 1;
	player.debreeSeekSpeedMultiplier = getToolUpgradeLvlValue("debreeSpeed") ?? 1;
}

export function hasLvlValue(value: number | undefined, lvl: number) {
	if (value === undefined) return false;

	return value >= lvl;
}
