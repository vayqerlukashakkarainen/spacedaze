import { Tool } from "../upg";

export const blaster: Tool = {
	toolName: "Blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Add a blaster at the front of the ship as firepower",
			price: 12,
			sprite: "blaster1",
			value: 1,
		},
		{
			name: "Level 2",
			desc: "Add a second blaster to your ship",
			price: 12,
			sprite: "blaster1",
			value: 2,
		},
		{
			name: "Level 3",
			desc: "Add a third blaster to your ship",
			price: 12,
			sprite: "blaster1",
			value: 3,
		},
	],
};

export const blasterMultiple: Tool = {
	toolName: "Blaster wires",
	requiredTool: "blaster",
	upgrades: [
		{
			name: "Level 1",
			desc: "Fire all blasters at the same time",
			price: 12,
			sprite: "blaster_upg_speed1",
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
