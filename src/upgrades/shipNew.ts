import { UpgradeDefinition } from "../types/upgradeTypes";

export const debreeDist: UpgradeDefinition = {
	toolKey: "debreeDist",
	toolName: "Debree magnets",
	category: "resources",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			effects: {
				modifiers: [
					{
						stat: "debreeSeekDistanceMultiplier",
						value: 1.2,
						type: "multiply",
					},
				],
			},
		},
		{
			name: "Level 2",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			effects: {
				modifiers: [
					{
						stat: "debreeSeekDistanceMultiplier",
						value: 1.4,
						type: "multiply",
					},
				],
			},
		},
		{
			name: "Level 3",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			effects: {
				modifiers: [
					{
						stat: "debreeSeekDistanceMultiplier",
						value: 1.6,
						type: "multiply",
					},
				],
			},
		},
		{
			name: "Level 4",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			effects: {
				modifiers: [
					{
						stat: "debreeSeekDistanceMultiplier",
						value: 1.8,
						type: "multiply",
					},
				],
			},
		},
		{
			name: "Level 5",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeSeekDistanceMultiplier", value: 2, type: "multiply" },
				],
			},
		},
	],
};

export const debreeSpeed: UpgradeDefinition = {
	toolKey: "debreeSpeed",
	toolName: "Stronger magnets",
	category: "resources",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeSeekSpeedMultiplier", value: 1.2, type: "multiply" },
				],
			},
		},
		{
			name: "Level 2",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeSeekSpeedMultiplier", value: 1.4, type: "multiply" },
				],
			},
		},
		{
			name: "Level 3",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeSeekSpeedMultiplier", value: 2, type: "multiply" },
				],
			},
		},
	],
};

export const sprint: UpgradeDefinition = {
	toolKey: "sprint",
	toolName: "Thrusters overclock",
	category: "movement",
	type: "unlock",
	levels: [
		{
			name: "Level 1",
			desc: "Hold SHIFT to overclock thrusters, increasing speed",
			sprite: "overclock_thrusters_upg1",
			price: 32,
			effects: {
				unlocks: [
					{ unlockId: "sprint", description: "Sprint ability unlocked" },
				],
				modifiers: [
					{ stat: "sprintSpeedMultiplier", value: 1.2, type: "multiply" },
				],
			},
		},
		{
			name: "Level 2",
			desc: "Increase speed when overclocking thrusters",
			sprite: "overclock_thrusters_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "sprintSpeedMultiplier", value: 1.4, type: "multiply" },
				],
			},
		},
	],
};

export const sprintSpeed: UpgradeDefinition = {
	toolKey: "sprintSpeed",
	toolName: "Thrusters cooling",
	category: "movement",
	type: "stat",
	requiredTool: "sprint",
	levels: [
		{
			name: "Level 1",
			desc: "Pouring unknown liquid on the thrusters seems to make them go faster during overclock??",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "sprintSpeedMultiplier", value: 1.3, type: "multiply" },
				],
			},
		},
		{
			name: "Level 2",
			desc: "Pour more liquid, the ship probably need some pumps soon...",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "sprintSpeedMultiplier", value: 1.4, type: "multiply" },
				],
			},
		},
	],
};

export const movespeed: UpgradeDefinition = {
	toolKey: "movespeed",
	toolName: "Improved thrusters",
	category: "movement",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Bigger thrusters, more speed",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "speedMultiplier", value: 1.05, type: "multiply" }],
			},
		},
		{
			name: "Level 2",
			desc: "Bigger thrusters, more speed",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "speedMultiplier", value: 1.15, type: "multiply" }],
			},
		},
	],
};

export const debreeValue: UpgradeDefinition = {
	toolKey: "debreeValue",
	toolName: "Shiny debree",
	category: "resources",
	type: "stat",
	requiredTool: "debreeDist",
	levels: [
		{
			name: "Level 1",
			desc: "Debree becomes more valueable, who could have thought",
			sprite: "debree_value_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeValueMultiplier", value: 2, type: "multiply" },
				],
			},
		},
		{
			name: "Level 2",
			desc: "Debree becomes almost as valuable as gold",
			sprite: "debree_value_upg1",
			price: 32,
			effects: {
				modifiers: [
					{ stat: "debreeValueMultiplier", value: 3, type: "multiply" },
				],
			},
		},
	],
};

export const maxHealth: UpgradeDefinition = {
	toolKey: "maxHealth",
	toolName: "Stronger hull",
	category: "survival",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 3, type: "base" }],
			},
		},
		{
			name: "Level 2",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 4, type: "base" }],
			},
		},
		{
			name: "Level 3",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 5, type: "base" }],
			},
		},
		{
			name: "Level 4",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 6, type: "base" }],
			},
		},
		{
			name: "Level 5",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 7, type: "base" }],
			},
		},
		{
			name: "Level 6",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 8, type: "base" }],
			},
		},
		{
			name: "Level 7",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 9, type: "base" }],
			},
		},
		{
			name: "Level 8",
			desc: "Upgrade hull and increase health by one",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 10, type: "base" }],
			},
		},
	],
};
