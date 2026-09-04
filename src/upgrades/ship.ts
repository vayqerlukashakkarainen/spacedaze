import { Tool } from "../upg";

export const debreeDist: Tool = {
	toolName: "Debree magnets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.4,
		},
		{
			name: "Level 3",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.6,
		},
		{
			name: "Level 4",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.8,
		},
		{
			name: "Level 5",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 2,
		},
	],
};

export const sprint: Tool = {
	toolName: "Thrusters overclock",
	upgrades: [
		{
			name: "Level 1",
			desc: "Hold SHIFT to overclock thrusters, increasing speed",
			sprite: "overclock_thrusters_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Increase speed when overclocking thrusters",
			sprite: "overclock_thrusters_upg1",
			price: 32,
			value: 1.4,
		},
	],
};

export const sprintSpeed: Tool = {
	toolName: "Thrusters cooling",
	requirements: { allOf: [{ toolKey: "sprint" }] },
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
			desc: "Press SPACE to phase a short distance through incoming fire",
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
	toolName: "Shiny debree",
	requirements: { allOf: [{ toolKey: "debreeDist" }] },
	upgrades: [
		{
			name: "Level 1",
			desc: "Debree becomes more valueable, who could have thought",
			sprite: "debree_value_upg1",
			price: 32,
			value: 2,
		},
		{
			name: "Level 2",
			desc: "Debree becomes almost as valuable as gold",
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
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 4,
		},
		{
			name: "Level 2",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 5,
		},
		{
			name: "Level 3",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 6,
		},
		{
			name: "Level 4",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 7,
		},
		{
			name: "Level 5",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 8,
		},
		{
			name: "Level 6",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 9,
		},
		{
			name: "Level 7",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			value: 10,
		},
	],
};
