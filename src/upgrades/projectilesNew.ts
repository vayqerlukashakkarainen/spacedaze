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

const COMPONENT_DAMAGE_MULTIPLIERS = [1.2, 1.3, 1.4, 1.5, 1.6]

export const componentShear: UpgradeDefinition = {
	toolKey: "componentShear",
	toolName: "Component shear",
	category: "combat",
	type: "passive",
	levels: COMPONENT_DAMAGE_MULTIPLIERS.map((multiplier, index) => ({
		name: STACK_NAMES[index],
		desc: `Projectiles deal ${Math.round(multiplier * 100)}% damage to enemy parts; core damage is unchanged`,
		price: 18 + index * 4,
		sprite: "armor_piercing_upg1",
		effects: {
			modifiers: [{
				stat: "projectilePartDamageMultiplier",
				value: multiplier,
				type: "multiply",
			}],
		},
	})),
}

export const coreBreach: UpgradeDefinition = {
	toolKey: "coreBreach",
	toolName: "Core breach",
	category: "combat",
	type: "passive",
	levels: COMPONENT_DAMAGE_MULTIPLIERS.map((multiplier, index) => ({
		name: STACK_NAMES[index],
		desc: `Projectiles deal ${Math.round(multiplier * 100)}% damage to enemy cores; part damage is unchanged`,
		price: 18 + index * 4,
		sprite: "blaster_upg_dmg1",
		effects: {
			modifiers: [{
				stat: "projectileCoreDamageMultiplier",
				value: multiplier,
				type: "multiply",
			}],
		},
	})),
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

export const stunRounds: UpgradeDefinition = {
	toolKey: "stunRounds",
	toolName: "Stun rounds",
	category: "combat",
	type: "passive",
	levels: [0.05, 0.08, 0.11, 0.14, 0.17].map((chance, index) => {
		const duration = 0.4 + index * 0.05
		const durationLabel = duration.toFixed(2).replace(/0$/, "")
		return {
			name: STACK_NAMES[index],
			desc: `${Math.round(chance * 100)}% chance for projectile hits to stun enemies for ${durationLabel} seconds`,
			price: 18 + index * 4,
			sprite: "stun_rounds_upg1",
			effects: {
				modifiers: [
					{
						stat: "projectileStunChance",
						value: chance,
						type: "base" as const,
					},
					{
						stat: "projectileStunDuration",
						value: duration,
						type: "base" as const,
					},
				],
			},
		}
	}),
}

export const empRounds: UpgradeDefinition = {
	toolKey: "empRounds",
	toolName: "EMP rounds",
	category: "combat",
	type: "passive",
	levels: [0.12, 0.17, 0.22, 0.27, 0.32].map((chance, index) => {
		const duration = 1.2 + index * 0.2
		const slowPercentage = 0.65 + index * 0.05
		return {
			name: STACK_NAMES[index],
			desc: `${Math.round(chance * 100)}% chance to load a projectile with EMP, slowing and disrupting its target for ${duration} seconds`,
			price: 20 + index * 5,
			sprite: "active_emp_beacon",
			effects: {
				modifiers: [
					{
						stat: "projectileEmpChance",
						value: chance,
						type: "base" as const,
					},
					{
						stat: "projectileEmpDuration",
						value: duration,
						type: "base" as const,
					},
					{
						stat: "projectileEmpSlowPercentage",
						value: slowPercentage,
						type: "base" as const,
					},
				],
			},
		}
	}),
}

export const corrosivePayload: UpgradeDefinition = {
	toolKey: "corrosivePayload",
	toolName: "Corrosive payload",
	category: "combat",
	type: "passive",
	levels: [0.25, 0.5, 0.75, 1, 1.25].map((damageRatio, index) =>
		statLevel(
			index,
			`Projectile hits deal ${Math.round(damageRatio * 100)}% projectile damage every 0.5 seconds for ${2 + index * 0.25} seconds`,
			"corrosive_payload_upg1",
			"projectileDotDamage",
			damageRatio,
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
			`Projectile hits arc across ${targets} total targets at ${55 + index * 5}% projectile damage`,
			"arc_capacitor_upg1",
			"projectileChainCount",
			targets,
			24 + index * 6
		)
	),
}

export const lifesteal: UpgradeDefinition = {
	toolKey: "lifesteal",
	toolName: "Lifesteal",
	category: "combat",
	type: "passive",
	levels: [0.05, 0.075, 0.1, 0.125, 0.15].map((healthRatio, index) =>
		statLevel(
			index,
			`Projectile hits return ${healthRatio * 100}% of damage dealt as hull when the siphon reaches you`,
			"hull_upg1",
			"projectileLifesteal",
			healthRatio,
			24 + index * 7
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
			`Blaster shots split into ${count} projectiles dealing ${Math.round((1.2 + index * 0.1) / count * 100)}% projectile damage each`,
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
