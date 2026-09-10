import { Tool } from "../upg";

export const salvageLasso: Tool = {
	toolName: "Salvage Lasso",
	upgrades: [
		{
			name: "Salvage Lasso",
			desc: "Unlock the lasso link for towing and throwing loose objects",
			sprite: "salvage_lasso",
			price: 32,
			value: 1,
		},
	],
};

function lassoTool(
	toolName: string,
	descriptions: readonly string[],
	sprite: string,
	values: readonly number[],
	prices: readonly number[]
): Tool {
	return {
		toolName,
		requirements: { allOf: [{ toolKey: "salvageLasso" }] },
		upgrades: descriptions.map((desc, index) => ({
			name: descriptions.length === 1 ? toolName : `Level ${index + 1}`,
			desc,
			sprite,
			price: prices[index],
			value: values[index],
		})),
	}
}

export const kineticCoupler = lassoTool(
	"Kinetic Coupler",
	["Lasso impacts deal 15% more damage", "Lasso impacts deal 30% more damage", "Lasso impacts deal 45% more damage"],
	"kinetic_coupler_upg1",
	[1.15, 1.3, 1.45],
	[24, 32, 42]
)

export const torqueSpool = lassoTool(
	"Torque Spool",
	["Pull tethered objects with 10% more acceleration", "Pull tethered objects with 20% more acceleration", "Pull tethered objects with 30% more acceleration"],
	"torque_spool_upg1",
	[1.1, 1.2, 1.3],
	[22, 30, 40]
)

export const shockCradle = lassoTool(
	"Shock Cradle",
	["Tethered objects take 20% less collision damage", "Tethered objects take 35% less collision damage", "Tethered objects take 50% less collision damage"],
	"shock_cradle_upg1",
	[0.2, 0.35, 0.5],
	[30, 40, 52]
)

export const momentumRelay = lassoTool(
	"Momentum Relay",
	["Thrown objects retain 70% velocity after impacts", "Thrown objects retain 80% velocity after impacts", "Thrown objects retain 90% velocity after impacts"],
	"momentum_relay_upg1",
	[0.1, 0.2, 0.3],
	[38, 50, 64]
)

export const redlineCable = lassoTool(
	"Redline Cable",
	["Hold above 55% tension for 0.75 seconds to charge the next aimed Strafe throw"],
	"redline_cable_upg1",
	[1],
	[72]
)

export const debreeDist: Tool = {
	toolName: "Salvage magnets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase the ship's salvage collection range",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Increase the ship's salvage collection range",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.4,
		},
		{
			name: "Level 3",
			desc: "Increase the ship's salvage collection range",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.6,
		},
		{
			name: "Level 4",
			desc: "Increase the ship's salvage collection range",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.8,
		},
		{
			name: "Level 5",
			desc: "Increase the ship's salvage collection range",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 2,
		},
	],
};

export const sprintSpeed: Tool = {
	toolName: "Thrusters cooling",
	requirements: { allOf: [{ toolKey: "thrusterOverdrive" }] },
	upgrades: [
		{
			name: "Level 1",
			desc: "Pouring unknown liquid on the thrusters seems to make them go faster during overclock??",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.3,
		},
		{
			name: "Level 2",
			desc: "Pour more liquid, the ship probably need some pumps soon...",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.4,
		},
	],
};

export const spaceJump: Tool = {
	toolName: "Space Jump",
	upgrades: [
		{
			name: "Space Jump",
				desc: "Phase a short distance through incoming fire",
			sprite: "space_jump_upg1",
			price: 32,
			value: 1,
		},
	],
};

export const spaceJumpUpgrades: Tool = {
	toolName: "Space Jump Systems",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	upgrades: [
		{
			name: "Phase Capacitor",
			desc: "Jump farther and recharge the phase drive faster for this run",
			sprite: "phase_capacitor_upg1",
			price: 48,
			value: 1,
		},
		{
			name: "Twin Capacitor",
			desc: "Store two Space Jump charges for this run",
			sprite: "twin_capacitor_upg1",
			price: 64,
			value: 2,
		},
	],
};

export const phaseRam: Tool = {
	toolName: "Phase Ram",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	upgrades: [
		{
			name: "Level 1",
			desc: "Space Jump damages enemies passed through",
			sprite: "space_jump_upg1",
			price: 36,
			value: 3,
		},
		{
			name: "Level 2",
			desc: "Increase Space Jump impact damage",
			sprite: "space_jump_upg1",
			price: 48,
			value: 5,
		},
		{
			name: "Level 3",
			desc: "Further increase Space Jump impact damage",
			sprite: "space_jump_upg1",
			price: 62,
			value: 8,
		},
	],
};

export const phaseMagazine: Tool = {
	toolName: "Phase Magazine",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	upgrades: [{
		name: "Phase Seeker Salvo",
		desc: "Completing a Space Jump releases 10 purple rounds that wiggle toward nearby enemies",
		sprite: "hunter_guidance_upg1",
		price: 52,
		value: 1,
	}],
};

export const movespeed: Tool = {
	toolName: "Cruise thrusters",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase movement speed during normal flight by 5%",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.05,
		},
		{
			name: "Level 2",
			desc: "Increase movement speed during normal flight by 15%",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.15,
		},
	],
};

export const strafeSpeed: Tool = {
	toolName: "Strafe thrusters",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase movement speed during strafe control by 5%",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.05,
		},
		{
			name: "Level 2",
			desc: "Increase movement speed during strafe control by 15%",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.15,
		},
	],
};

export const debreeValue: Tool = {
	toolName: "Refined salvage",
	requirements: { allOf: [{ toolKey: "debreeDist" }] },
	upgrades: [
		{
			name: "Level 1",
			desc: "Collected debris yields twice as much salvage",
			sprite: "debree_value_upg1",
			price: 32,
			value: 2,
		},
		{
			name: "Level 2",
			desc: "Collected debris yields three times as much salvage",
			sprite: "debree_value_upg1",
			price: 32,
			value: 3,
		},
	],
};

export const maxHealth: Tool = {
	toolName: "Stronger hull",
	upgrades: [
		{
			name: "Level 1",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 115,
		},
		{
			name: "Level 2",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 130,
		},
		{
			name: "Level 3",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 145,
		},
		{
			name: "Level 4",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 160,
		},
		{
			name: "Level 5",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 175,
		},
		{
			name: "Level 6",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 190,
		},
		{
			name: "Level 7",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			value: 205,
		},
	],
};

export const extraLife: Tool = {
	toolName: "Phase Recall",
	upgrades: [
		{
			name: "Mark I",
			desc: "Begin each run with 1 recall charge. Fatal damage consumes it and reconstructs the ship where it was destroyed",
			sprite: "phase_recall_upg1",
			price: 32,
			value: 1,
		},
		{
			name: "Mark II",
			desc: "Begin each run with 2 recall charges",
			sprite: "phase_recall_upg1",
			price: 32,
			value: 2,
		},
		{
			name: "Mark III",
			desc: "Begin each run with 3 recall charges",
			sprite: "phase_recall_upg1",
			price: 32,
			value: 3,
		},
	],
};
