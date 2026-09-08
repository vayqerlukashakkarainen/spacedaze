import { UpgradeDefinition } from "../types/upgradeTypes";

export const debreeDist: UpgradeDefinition = {
	toolKey: "debreeDist",
	toolName: "Salvage magnets",
	category: "resources",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Increase the ship's salvage collection range",
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
			desc: "Increase the ship's salvage collection range",
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
			desc: "Increase the ship's salvage collection range",
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
			desc: "Increase the ship's salvage collection range",
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
			desc: "Increase the ship's salvage collection range",
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

export const sprintSpeed: UpgradeDefinition = {
	toolKey: "sprintSpeed",
	toolName: "Thrusters cooling",
	category: "movement",
	type: "stat",
	requirements: { allOf: [{ toolKey: "thrusterOverdrive" }] },
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

export const spaceJump: UpgradeDefinition = {
	toolKey: "spaceJump",
	toolName: "Space Jump",
	category: "movement",
	type: "ability",
	levels: [
		{
			name: "Space Jump",
			desc: "Press SPACE to phase 75px through incoming fire. Recharges in 2.5 seconds",
			sprite: "space_jump_upg1",
			price: 32,
			effects: {
				abilities: [
					{ abilityId: "spaceJump", description: "Space Jump unlocked", cooldown: 2.5 },
				],
			},
		},
	],
};

export const spaceJumpUpgrades: UpgradeDefinition = {
	toolKey: "spaceJumpUpgrades",
	toolName: "Space Jump Systems",
	category: "movement",
	type: "ability",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	levels: [
		{
			name: "Phase Capacitor",
			desc: "Space Jump travels 90px and recharges in 2.1 seconds for this run",
			sprite: "phase_capacitor_upg1",
			price: 48,
			effects: {
				abilities: [
					{ abilityId: "spaceJump", description: "Improved Space Jump", cooldown: 2.1 },
				],
			},
		},
		{
			name: "Twin Capacitor",
			desc: "Store two Space Jump charges for this run. Each charge recharges in 3 seconds",
			sprite: "twin_capacitor_upg1",
			price: 64,
			effects: {
				abilities: [
					{ abilityId: "spaceJump", description: "Two Space Jump charges", cooldown: 3 },
				],
			},
		},
	],
};

export const phaseRam: UpgradeDefinition = {
	toolKey: "phaseRam",
	toolName: "Phase Ram",
	category: "movement",
	type: "passive",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	levels: [3, 5, 8].map((damage, index) => ({
		name: `Level ${index + 1}`,
		desc: `Space Jump deals ${damage} damage to each enemy passed through`,
		sprite: "space_jump_upg1",
		price: [36, 48, 62][index],
		effects: {
			modifiers: [
				{ stat: "spaceJumpDamage", value: damage, type: "base" },
			],
		},
	})),
};

export const phaseMagazine: UpgradeDefinition = {
	toolKey: "phaseMagazine",
	toolName: "Phase Magazine",
	category: "combat",
	type: "passive",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	levels: [{
		name: "Phase Seeker Salvo",
		desc: "Completing a Space Jump releases 10 purple rounds that wiggle toward nearby enemies",
		sprite: "hunter_guidance_upg1",
		price: 52,
		effects: {
			unlocks: [{
				unlockId: "phaseMagazine",
				description: "Space Jump releases ten seeking phase rounds",
			}],
		},
	}],
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
	toolName: "Refined salvage",
	category: "resources",
	type: "stat",
	requirements: { allOf: [{ toolKey: "debreeDist" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Collected debris yields twice as much salvage",
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
			desc: "Collected debris yields three times as much salvage",
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
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 115, type: "base" }],
			},
		},
		{
			name: "Level 2",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 130, type: "base" }],
			},
		},
		{
			name: "Level 3",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 145, type: "base" }],
			},
		},
		{
			name: "Level 4",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 160, type: "base" }],
			},
		},
		{
			name: "Level 5",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 175, type: "base" }],
			},
		},
		{
			name: "Level 6",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 190, type: "base" }],
			},
		},
		{
			name: "Level 7",
			desc: "Upgrade hull and increase health by 15",
			sprite: "hull_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "maxHealth", value: 205, type: "base" }],
			},
		},
	],
};
