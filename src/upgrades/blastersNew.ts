import { UpgradeDefinition } from "../types/upgradeTypes";

export const blaster: UpgradeDefinition = {
	toolKey: "blaster",
	toolName: "Blaster",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Level 1",
			desc: "Add a second blaster to your ship",
			price: 12,
			sprite: "blaster1",
			effects: {
				modifiers: [{ stat: "blasterCount", value: 2, type: "base" }],
				unlocks: [{ unlockId: "blaster", description: "Blasters unlocked" }],
			},
		},
		{
			name: "Level 2",
			desc: "Add a third blaster to your ship",
			price: 12,
			sprite: "blaster1",
			effects: {
				modifiers: [{ stat: "blasterCount", value: 3, type: "base" }],
			},
		},
	],
};

export const blasterMultiple: UpgradeDefinition = {
	toolKey: "blasterParallel",
	toolName: "Parallel processor",
	category: "combat",
	type: "unlock",
	requirements: { allOf: [{ toolKey: "blaster" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Fire all blasters at the same time",
			price: 12,
			sprite: "parallel_blasters_upg1",
			effects: {
				unlocks: [
					{
						unlockId: "blasterParallel",
						description: "Fire all blasters simultaneously",
					},
				],
			},
		},
	],
};

export const mouseAim: UpgradeDefinition = {
	toolKey: "mouseAim",
	toolName: "Targeting computer",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Level 1",
			desc: "Aim weapons independently toward the mouse pointer",
			price: 24,
			sprite: "parallel_blasters_upg1",
			effects: {
				unlocks: [
					{
						unlockId: "mouseAim",
						description: "Mouse-directed weapon aiming unlocked",
					},
				],
			},
		},
	],
};

export const blasterSpeed: UpgradeDefinition = {
	toolKey: "blasterSpeed",
	toolName: "Blaster speed",
	category: "combat",
	type: "stat",
	requirements: { allOf: [{ toolKey: "blaster" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Increase velocity of blaster projectiles",
			price: 12,
			sprite: "blaster_upg_speed1",
			effects: {
				modifiers: [
					{ stat: "blasterSpeedMultiplier", value: 1.65, type: "multiply" },
				],
			},
		},
	],
};

export const blasterDmg: UpgradeDefinition = {
	toolKey: "blasterDmg",
	toolName: "Blaster dmg",
	category: "combat",
	type: "stat",
	requirements: { allOf: [{ toolKey: "blaster" }] },
	levels: [
		{
			name: "Level 1",
			desc: "Increase damage of the ships primary blasters",
			price: 12,
			sprite: "blaster_upg_dmg1",
			effects: {
				modifiers: [
					{ stat: "blasterDmgMultiplier", value: 2, type: "multiply" },
				],
			},
		},
	],
};
