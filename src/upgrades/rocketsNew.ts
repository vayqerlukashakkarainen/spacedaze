import { UpgradeDefinition } from "../types/upgradeTypes";

export const rocket: UpgradeDefinition = {
	toolKey: "rockets",
	toolName: "Missile barrage",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Level 1",
			desc: "Install missile pods to the ship, right mouse to fire",
			sprite: "rocket_upg1",
			price: 22,
			effects: {
				unlocks: [
					{ unlockId: "rockets", description: "Rocket barrage unlocked" },
				],
			},
		},
	],
};

export const increaseRockets: UpgradeDefinition = {
	toolKey: "nrOfRockets",
	toolName: "Increase missiles",
	category: "combat",
	type: "stat",
	requirements: { allOf: [{ toolKey: "rockets" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Increase missiles to 6",
			sprite: "more_missiles_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketCount", value: 6, type: "base" }],
			},
		},
		{
			name: "Level 2",
			desc: "Increase missiles to 8",
			sprite: "more_missiles_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketCount", value: 8, type: "base" }],
			},
		},
		{
			name: "Level 3",
			desc: "Increase missiles to 10",
			sprite: "more_missiles_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketCount", value: 10, type: "base" }],
			},
		},
		{
			name: "Level 4",
			desc: "Increase missiles to 16, missiles will be taped outside the pod",
			sprite: "more_missiles_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketCount", value: 16, type: "base" }],
			},
		},
	],
};

export const rocketShards: UpgradeDefinition = {
	toolKey: "rocketShards",
	toolName: "Missile shards",
	category: "combat",
	type: "stat",
	requirements: { allOf: [{ toolKey: "rockets" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Missiles are loaded with space debree, shooting shards when exploded",
			sprite: "missile_shards_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketShards", value: 5, type: "base" }],
			},
		},
		{
			name: "Level 2",
			desc: "Squeeze some more debree in those missiles!!",
			sprite: "missile_shards_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketShards", value: 7, type: "base" }],
			},
		},
		{
			name: "Level 3",
			desc: "Squeeze some more debree in those missiles!!",
			sprite: "missile_shards_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "rocketShards", value: 9, type: "base" }],
			},
		},
	],
};
