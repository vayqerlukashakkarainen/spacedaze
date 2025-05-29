import { Tool } from "../upg";

export const blaster: Tool = {
	toolName: "Blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Add a second blaster to your ship",
			price: 12,
			sprite: "blaster1",
			value: 1,
		},
		{
			name: "Level 2",
			desc: "Add a third blaster to your ship",
			price: 12,
			sprite: "blaster1",
			value: 2,
		},
	],
};

export const blasterMultiple: Tool = {
	toolName: "Parallel processor",
	requiredTool: "blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Fire all blasters at the same time",
			price: 12,
			sprite: "parallel_blasters_upg1",
			value: 1,
		},
	],
};

export const blasterSpeed: Tool = {
	toolName: "Blaster speed",
	requiredTool: "blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase velocity of blaster projectiles",
			price: 12,
			sprite: "blaster_upg_speed1",
			value: 1.65,
		},
	],
};

export const blasterDmg: Tool = {
	toolName: "Blaster dmg",
	requiredTool: "blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase damage of the ships primary blasters",
			price: 12,
			sprite: "blaster_upg_dmg1",
			value: 2,
		},
	],
};
