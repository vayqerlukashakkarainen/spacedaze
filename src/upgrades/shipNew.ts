import { UpgradeDefinition } from "../types/upgradeTypes";

export const salvageLasso: UpgradeDefinition = {
	toolKey: "salvageLasso",
	toolName: "Salvage Lasso",
	category: "special",
	type: "unlock",
	levels: [
		{
			name: "Salvage Lasso",
			desc: "Unlock the lasso link for towing and throwing loose objects",
			sprite: "salvage_lasso",
			price: 32,
			effects: {
				unlocks: [{
					unlockId: "salvageLasso",
					description: "Cast a lasso link at loose objects",
				}],
			},
		},
	],
};

const LASSO_REQUIREMENT = { allOf: [{ toolKey: "salvageLasso" }] } as const

function lassoStatLevels(
	values: readonly number[],
	describe: (value: number) => string,
	sprite: string,
	stat: string,
	prices: readonly number[]
) {
	return values.map((value, index) => ({
		name: `Level ${index + 1}`,
		desc: describe(value),
		sprite,
		price: prices[index],
		effects: {
			modifiers: [{ stat, value, type: "multiply" as const }],
		},
	}))
}

export const kineticCoupler: UpgradeDefinition = {
	toolKey: "kineticCoupler",
	toolName: "Kinetic Coupler",
	category: "special",
	type: "passive",
	requirements: LASSO_REQUIREMENT,
	levels: lassoStatLevels(
		[1.15, 1.3, 1.45],
		(value) => `Lasso impacts deal ${Math.round((value - 1) * 100)}% more damage`,
		"kinetic_coupler_upg1",
		"lassoSlamDamageMultiplier",
		[24, 32, 42]
	),
}

export const torqueSpool: UpgradeDefinition = {
	toolKey: "torqueSpool",
	toolName: "Torque Spool",
	category: "special",
	type: "passive",
	requirements: LASSO_REQUIREMENT,
	levels: lassoStatLevels(
		[1.1, 1.2, 1.3],
		(value) => `Pull tethered objects with ${Math.round((value - 1) * 100)}% more acceleration without reducing impact mass`,
		"torque_spool_upg1",
		"lassoPullAccelerationMultiplier",
		[22, 30, 40]
	),
}

export const shockCradle: UpgradeDefinition = {
	toolKey: "shockCradle",
	toolName: "Shock Cradle",
	category: "special",
	type: "passive",
	requirements: LASSO_REQUIREMENT,
	levels: [0.2, 0.35, 0.5].map((reduction, index) => ({
		name: `Level ${index + 1}`,
		desc: `Tethered objects take ${Math.round(reduction * 100)}% less collision damage`,
		sprite: "shock_cradle_upg1",
		price: [30, 40, 52][index],
		effects: {
			modifiers: [{
				stat: "lassoSelfDamageReduction",
				value: reduction,
				type: "additive" as const,
			}],
		},
	})),
}

export const momentumRelay: UpgradeDefinition = {
	toolKey: "momentumRelay",
	toolName: "Momentum Relay",
	category: "special",
	type: "passive",
	requirements: LASSO_REQUIREMENT,
	levels: [0.1, 0.2, 0.3].map((bonus, index) => ({
		name: `Level ${index + 1}`,
		desc: `Thrown objects retain ${Math.round((0.6 + bonus) * 100)}% velocity after impacts`,
		sprite: "momentum_relay_upg1",
		price: [38, 50, 64][index],
		effects: {
			modifiers: [{
				stat: "lassoImpactVelocityRetentionBonus",
				value: bonus,
				type: "additive" as const,
			}],
		},
	})),
}

export const redlineCable: UpgradeDefinition = {
	toolKey: "redlineCable",
	toolName: "Redline Cable",
	category: "special",
	type: "passive",
	requirements: LASSO_REQUIREMENT,
	levels: [{
		name: "Redline Cable",
		desc: "Hold above 55% tension for 0.75 seconds to charge the next aimed Strafe throw",
		sprite: "redline_cable_upg1",
		price: 72,
		effects: {
			modifiers: [
				{ stat: "lassoRedlineLaunchSpeedMultiplier", value: 1.25, type: "multiply" },
				{ stat: "lassoRedlineDamageMultiplier", value: 1.35, type: "multiply" },
			],
		},
	}],
}

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
				desc: "Phase 75px through incoming fire. Recharges in 2.5 seconds",
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
	toolName: "Cruise thrusters",
	category: "movement",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Increase movement speed during normal flight by 5%",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "speedMultiplier", value: 1.05, type: "multiply" }],
			},
		},
		{
			name: "Level 2",
			desc: "Increase movement speed during normal flight by 15%",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{ stat: "speedMultiplier", value: 1.15, type: "multiply" }],
			},
		},
	],
};

export const strafeSpeed: UpgradeDefinition = {
	toolKey: "strafeSpeed",
	toolName: "Strafe thrusters",
	category: "movement",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Increase movement speed during strafe control by 5%",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{
					stat: "strafeSpeedMultiplier",
					value: 1.05,
					type: "multiply",
				}],
			},
		},
		{
			name: "Level 2",
			desc: "Increase movement speed during strafe control by 15%",
			sprite: "faster_speed_upg1",
			price: 32,
			effects: {
				modifiers: [{
					stat: "strafeSpeedMultiplier",
					value: 1.15,
					type: "multiply",
				}],
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

export const extraLife: UpgradeDefinition = {
	toolKey: "extraLife",
	toolName: "Phase Recall",
	category: "survival",
	type: "passive",
	levels: [1, 2, 3].map((charges, index) => ({
		name: `Mark ${["I", "II", "III"][index]}`,
		desc: index === 0
			? "Begin each run with 1 recall charge. Fatal damage reconstructs the ship at the point of destruction"
			: `Begin each run with ${charges} recall charges`,
		sprite: "phase_recall_upg1",
		price: 32,
		effects: {
			modifiers: [{ stat: "extraLives", value: charges, type: "base" }],
		},
	})),
};
