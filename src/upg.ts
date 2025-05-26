import { saveGame } from "./util";

interface Upgrade {
	name: string;
	desc: string;
	price: number;
	sprite: string;
	value: number;
}

export type ToolKey = keyof typeof upgrades;

export interface Tool {
	toolName: string;
	requiredTool?: ToolKey;
	upgrades: Upgrade[];
}

const blaster: Tool = {
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
			desc: "Upgrade the ships blaster cabels, firing both blasters at the same time",
			price: 12,
			sprite: "blaster1",
			value: 3,
		},
		{
			name: "Level 4",
			desc: "Add a third blaster to your ship",
			price: 12,
			sprite: "blaster1",
			value: 4,
		},
	],
};

const blasterDmg: Tool = {
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

const blasterSpeed: Tool = {
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

const rocket: Tool = {
	toolName: "Rockets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Install rocket pods to the ship",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
	],
};

const debreeDist: Tool = {
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

const debreeSpeed: Tool = {
	toolName: "Stronger magnets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Stronger magnets = faster debree",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Stronger magnets = faster debree",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.4,
		},
		{
			name: "Level 3",
			desc: "Stronger magnets = faster debree",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 2,
		},
	],
};

export const upgrades = {
	blaster: blaster,
	blasterDmg: blasterDmg,
	blasterSpeed: blasterSpeed,
	rockets: rocket,
	debreeDist: debreeDist,
	debreeSpeed: debreeSpeed,
} as const;

export let loadout: Record<ToolKey, number | undefined> = {
	blaster: undefined,
	blasterDmg: undefined,
	blasterSpeed: undefined,
	rockets: undefined,
	debreeDist: undefined,
	debreeSpeed: undefined,
};

export function getToolUpgradeLvlValue(key: ToolKey) {
	if (loadout[key] === undefined) return undefined;

	return upgrades[key].upgrades[loadout[key]].value;
}

export function addLvl(key: ToolKey) {
	loadout[key] = getNextLvl(key);
	saveGame("slot1");
}

export function getNextLvl(key: ToolKey) {
	if (loadout[key] === undefined) return 0;
	return loadout[key] + 1;
}

export function setLoadout(set: Record<string, number | undefined>) {
	loadout = set;
}
