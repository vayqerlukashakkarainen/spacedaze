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
	toolName: "Improved thrusters",
	upgrades: [
		{
			name: "Level 1",
			desc: "Bigger thrusters, more speed",
			sprite: "faster_speed_upg1",
			price: 32,
			value: 1.05,
		},
		{
			name: "Level 2",
			desc: "Bigger thrusters, more speed",
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
