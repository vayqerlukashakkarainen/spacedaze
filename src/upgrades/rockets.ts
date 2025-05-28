import { Tool } from "../upg";

export const rocket: Tool = {
	toolName: "Missile barrage",
	upgrades: [
		{
			name: "Level 1",
			desc: "Install missile pods to the ship",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
	],
};

export const increaseRockets: Tool = {
	toolName: "Increase missiles",
	requiredTool: "rockets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase missiles to 6",
			sprite: "rocket_upg1",
			price: 22,
			value: 6,
		},
		{
			name: "Level 2",
			desc: "Increase missiles to 8",
			sprite: "rocket_upg1",
			price: 22,
			value: 8,
		},
		{
			name: "Level 3",
			desc: "Increase missiles to 10",
			sprite: "rocket_upg1",
			price: 22,
			value: 10,
		},
		{
			name: "Level 4",
			desc: "Increase missiles to 16, missiles will be taped outside the pod",
			sprite: "rocket_upg1",
			price: 22,
			value: 16,
		},
	],
};

export const rocketShards: Tool = {
	toolName: "Missile shards",
	requiredTool: "rockets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Missiles are loaded with space debree, shooting shards when exploded",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
	],
};

export const rocketShardsAmount: Tool = {
	toolName: "Moar missile shards",
	requiredTool: "rocketShards",
	upgrades: [
		{
			name: "Level 1",
			desc: "Squeeze some more debree in those missiles!!",
			sprite: "rocket_upg1",
			price: 22,
			value: 5,
		},
		{
			name: "Level 2",
			desc: "Squeeze some more debree in those missiles!!",
			sprite: "rocket_upg1",
			price: 22,
			value: 7,
		},
		{
			name: "Level 3",
			desc: "Squeeze some more debree in those missiles!!",
			sprite: "rocket_upg1",
			price: 22,
			value: 9,
		},
	],
};
