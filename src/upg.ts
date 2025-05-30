import {
	blaster,
	blasterDmg,
	blasterMultiple,
	blasterSpeed,
} from "./upgrades/blasters";
import { followerBlasterDmg, followerMissiles } from "./upgrades/follower";
import { increaseRockets, rocket, rocketShards } from "./upgrades/rockets";
import {
	debreeDist,
	debreeSpeed,
	debreeValue,
	maxHealth,
	movespeed,
	sprint,
	sprintSpeed,
} from "./upgrades/ship";
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

export const upgrades = {
	blaster: blaster,
	blasterParallel: blasterMultiple,
	blasterDmg: blasterDmg,
	blasterSpeed: blasterSpeed,

	rockets: rocket,
	nrOfRockets: increaseRockets,
	rocketShards: rocketShards,

	debreeDist: debreeDist,
	debreeSpeed: debreeSpeed,
	debreeValue: debreeValue,

	sprint: sprint,
	sprintSpeed: sprintSpeed,

	movespeed: movespeed,
	maxHealth: maxHealth,

	followerBlasterDmg: followerBlasterDmg,
	followerMissiles: followerMissiles,
} as const;

export let loadout: Record<ToolKey, number | undefined> = {
	blaster: undefined,
	blasterDmg: undefined,
	blasterSpeed: undefined,
	rockets: undefined,
	debreeDist: undefined,
	debreeSpeed: undefined,
	nrOfRockets: undefined,
	sprint: undefined,
	movespeed: undefined,
	debreeValue: undefined,
	maxHealth: undefined,
	followerBlasterDmg: undefined,
	followerMissiles: undefined,
	rocketShards: undefined,
	sprintSpeed: undefined,
	blasterParallel: undefined,
};

export let levelLoadout: Record<ToolKey, number | undefined> = {
	blaster: undefined,
	blasterDmg: undefined,
	blasterSpeed: undefined,
	rockets: undefined,
	debreeDist: undefined,
	debreeSpeed: undefined,
	nrOfRockets: undefined,
	sprint: undefined,
	movespeed: undefined,
	debreeValue: undefined,
	maxHealth: undefined,
	followerBlasterDmg: undefined,
	followerMissiles: undefined,
	rocketShards: undefined,
	sprintSpeed: undefined,
	blasterParallel: undefined,
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

export function resetLevelLoadout() {
	levelLoadout = {
		blaster: undefined,
		blasterDmg: undefined,
		blasterSpeed: undefined,
		rockets: undefined,
		debreeDist: undefined,
		debreeSpeed: undefined,
		nrOfRockets: undefined,
		sprint: undefined,
		movespeed: undefined,
		debreeValue: undefined,
		maxHealth: undefined,
		followerBlasterDmg: undefined,
		followerMissiles: undefined,
		rocketShards: undefined,
		sprintSpeed: undefined,
		blasterParallel: undefined,
	};
}
