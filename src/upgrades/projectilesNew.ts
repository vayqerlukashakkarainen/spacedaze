import { UpgradeDefinition, UpgradeLevel } from "../types/upgradeTypes"

const STACK_NAMES = [
	"Mark I",
	"Mark II",
	"Mark III",
	"Mark IV",
	"Mark V",
	"Mark VI",
]

function statLevel(
	index: number,
	desc: string,
	sprite: string,
	stat: string,
	value: number,
	price: number
): UpgradeLevel {
	return {
		name: STACK_NAMES[index],
		desc,
		price,
		sprite,
		effects: {
			modifiers: [{ stat, value, type: "base" }],
		},
	}
}

export const armorPiercing: UpgradeDefinition = {
	toolKey: "armorPiercing",
	toolName: "Armor-piercing rounds",
	category: "combat",
	type: "passive",
	levels: [1, 2, 3, 4, 5].map((pierces, index) =>
		statLevel(
			index,
			`Projectiles pierce ${pierces} ${pierces === 1 ? "enemy" : "enemies"} and retain more damage per stack`,
			"armor_piercing_upg1",
			"projectilePierces",
			pierces,
			18 + index * 4
		)
	),
}

const RICOCHET_DAMAGE_RETENTION = [65, 72, 79, 86, 93]

export const ricochetRounds: UpgradeDefinition = {
	toolKey: "ricochetRounds",
	toolName: "Ricochet rounds",
	category: "combat",
	type: "passive",
	levels: RICOCHET_DAMAGE_RETENTION.map((retention, index) => ({
		name: STACK_NAMES[index],
		desc: `Projectiles bounce ${index + 1} ${index === 0 ? "time" : "times"} and retain ${retention}% damage after each bounce`,
		price: 22 + index * 6,
		sprite: "ricochet_rounds_upg1",
		effects: {
			modifiers: [
				{
					stat: "projectileBounceCount",
					value: index + 1,
					type: "base",
				},
				{
					stat: "projectileBounceDamageRetention",
					value: retention / 100,
					type: "base",
				},
			],
		},
	})),
}

export const ricochetModifierLink: UpgradeDefinition = {
	toolKey: "ricochetModifierLink",
	toolName: "Ricochet modifier link",
	category: "combat",
	type: "unlock",
	requirements: { allOf: [{ toolKey: "ricochetRounds" }] },
	levels: [
		{
			name: "Recursive Payload",
			desc: "Ricochet rounds retain all player projectile modifiers after bouncing",
			price: 36,
			sprite: "ricochet_rounds_upg1",
			effects: {
				unlocks: [
					{
						unlockId: "ricochetModifierInheritance",
						description: "Bounced shots retain player projectile modifiers",
					},
				],
			},
		},
	],
}

export const cryoRounds: UpgradeDefinition = {
	toolKey: "cryoRounds",
	toolName: "Cryogenic ammunition",
	category: "combat",
	type: "passive",
	levels: [0.15, 0.25, 0.35, 0.45, 0.55].map((slow, index) =>
		statLevel(
			index,
			`Projectile hits slow enemies by ${Math.round(slow * 100)}% for ${1.25 + index * 0.25} seconds`,
			"cryo_rounds_upg1",
			"projectileSlowPercentage",
			slow,
			18 + index * 4
		)
	),
}

export const corrosivePayload: UpgradeDefinition = {
	toolKey: "corrosivePayload",
	toolName: "Corrosive payload",
	category: "combat",
	type: "passive",
	levels: [0.5, 1, 1.5, 2, 2.5].map((damage, index) =>
		statLevel(
			index,
			`Projectile hits deal ${damage} damage every 0.5 seconds for ${2 + index * 0.25} seconds`,
			"corrosive_payload_upg1",
			"projectileDotDamage",
			damage,
			20 + index * 5
		)
	),
}

export const arcCapacitor: UpgradeDefinition = {
	toolKey: "arcCapacitor",
	toolName: "Arc capacitor",
	category: "combat",
	type: "passive",
	levels: [2, 3, 4, 5, 6].map((targets, index) =>
		statLevel(
			index,
			`Projectile hits arc across ${targets} total targets with improving damage retention`,
			"arc_capacitor_upg1",
			"projectileChainCount",
			targets,
			24 + index * 6
		)
	),
}

export const splitChamber: UpgradeDefinition = {
	toolKey: "splitChamber",
	toolName: "Split chamber",
	category: "combat",
	type: "passive",
	levels: [2, 3, 4, 5, 6].map((count, index) =>
		statLevel(
			index,
			`Blaster shots split into ${count} projectiles with diminishing per-shot damage`,
			"split_chamber_upg1",
			"projectileSplitCount",
			count,
			26 + index * 7
		)
	),
}

export const singularityPayload: UpgradeDefinition = {
	toolKey: "singularityPayload",
	toolName: "Singularity payload",
	category: "combat",
	type: "passive",
	levels: [50, 75, 100, 130, 165].map((strength, index) =>
		statLevel(
			index,
			`Projectiles pull nearby enemies with ${strength} gravity strength`,
			"singularity_payload_upg1",
			"projectileGravityStrength",
			strength,
			32 + index * 8
		)
	),
}

export const targetingMatrix: UpgradeDefinition = {
	toolKey: "targetingMatrix",
	toolName: "Targeting matrix",
	category: "combat",
	type: "passive",
	levels: [12.5, 20, 27.5, 35, 42.5, 50].map((critChance, index) =>
		statLevel(
			index,
			`Raises critical chance to ${critChance}%`,
			"parallel_blasters_upg1",
			"critChance",
			critChance,
			20 + index * 5
		)
	),
}

export const criticalPayload: UpgradeDefinition = {
	toolKey: "criticalPayload",
	toolName: "Critical payload",
	category: "combat",
	type: "passive",
	levels: [1.75, 2, 2.25, 2.5, 2.75].map((critMultiplier, index) =>
		statLevel(
			index,
			`Raises critical damage to ${critMultiplier}x`,
			"blaster_upg_dmg1",
			"critMultiplier",
			critMultiplier,
			24 + index * 6
		)
	),
}

export const kineticPulse: UpgradeDefinition = {
	toolKey: "kineticPulse",
	toolName: "Kinetic pulse",
	category: "combat",
	type: "passive",
	levels: [110, 160, 220, 290, 370].map((strength, index) =>
		statLevel(
			index,
			`Player explosions push nearby enemies away with ${strength} pulse force`,
			"singularity_payload_upg1",
			"explosionPulseStrength",
			strength,
			24 + index * 6
		)
	),
}
