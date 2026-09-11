import type { UpgradeDefinition, UpgradeLevel } from "../types/upgradeTypes"
import { THREE_LEVEL_PROJECTILE_MODIFIER_CHANCES } from "../services/combat/playerProjectileModifierChance"

const LEVEL_NAMES = ["Mark I", "Mark II", "Mark III"]

function level(
	index: number,
	desc: string,
	sprite: string,
	price: number,
	stats: Record<string, number>
): UpgradeLevel {
	return {
		name: LEVEL_NAMES[index],
		desc,
		price,
		sprite,
		effects: {
			modifiers: [
				...Object.entries(stats).map(([stat, value]) => ({
					stat,
					value,
					type: "base" as const,
				})),
				{
					stat: "projectileModifierChance",
					value: THREE_LEVEL_PROJECTILE_MODIFIER_CHANCES[index],
					type: "base",
				},
			],
		},
	}
}

function chanceLabel(index: number) {
	return Math.round(THREE_LEVEL_PROJECTILE_MODIFIER_CHANCES[index] * 100)
}

export const fragmentationCore: UpgradeDefinition = {
	toolKey: "fragmentationCore",
	toolName: "Fragmentation core",
	category: "combat",
	type: "passive",
	levels: [3, 4, 5].map((count, index) => level(
		index,
		`${chanceLabel(index)}% chance to load fragmentation rounds that burst into ${count} short-lived fragments dealing ${28 + index * 6}% projectile damage each`,
		"fragmentation_core_upg1",
		28 + index * 8,
		{
			projectileFragmentCount: count,
			projectileFragmentDamage: 0.28 + index * 0.06,
		}
	)),
}

export const hunterGuidance: UpgradeDefinition = {
	toolKey: "hunterGuidance",
	toolName: "Hunter guidance",
	category: "combat",
	type: "passive",
	levels: [
		{ turnSpeed: 0.018, distance: 140 },
		{ turnSpeed: 0.026, distance: 220 },
		{ turnSpeed: 0.036, distance: 320 },
	].map(({ turnSpeed, distance }, index) => level(
		index,
		`${chanceLabel(index)}% chance for target-locked Strafe Mode shots to load guidance within ${distance}px with ${index + 1} guidance strength`,
		"hunter_guidance_upg1",
		24 + index * 7,
		{
			projectileGuidance: turnSpeed,
			projectileGuidanceDistance: distance,
		}
	)),
}

export const proximityFuse: UpgradeDefinition = {
	toolKey: "proximityFuse",
	toolName: "Proximity fuse",
	category: "combat",
	type: "passive",
	levels: [20, 25, 30].map((radius, index) => level(
		index,
		`${chanceLabel(index)}% chance to load proximity rounds that detonate near targets within ${radius}px for ${55 + index * 10}% projectile damage`,
		"proximity_fuse_upg1",
		30 + index * 8,
		{
			projectileProximityRadius: radius,
			projectileProximityDamage: 0.55 + index * 0.1,
		}
	)),
}

export const afterimageRounds: UpgradeDefinition = {
	toolKey: "afterimageRounds",
	toolName: "Afterimage rounds",
	category: "combat",
	type: "passive",
	levels: [1, 2, 3].map((count, index) => level(
		index,
		`${chanceLabel(index)}% chance for shots to repeat ${count} ${count === 1 ? "time" : "times"} from their firing point at ${40 + index * 5}% projectile damage`,
		"afterimage_rounds_upg1",
		32 + index * 10,
		{
			projectileEchoCount: count,
			projectileEchoDamage: 0.4 + index * 0.05,
		}
	)),
}

export const growingCharge: UpgradeDefinition = {
	toolKey: "growingCharge",
	toolName: "Growing charge",
	category: "combat",
	type: "passive",
	levels: [1.45, 1.7, 2].map((damageRatio, index) => level(
		index,
		`${chanceLabel(index)}% chance to load growing charges that reach ${Math.round(damageRatio * 100)}% projectile damage over distance`,
		"growing_charge_upg1",
		24 + index * 8,
		{
			projectileGrowthDamage: damageRatio,
			projectileGrowthScale: 1.35 + index * 0.2,
		}
	)),
}

export const stasisBurst: UpgradeDefinition = {
	toolKey: "stasisBurst",
	toolName: "Stasis burst",
	category: "combat",
	type: "passive",
	requirements: { allOf: [{ toolKey: "cryoRounds" }] },
	levels: [70, 95, 125].map((radius, index) => level(
		index,
		`${chanceLabel(index)}% chance for cryogenic rounds to load stasis, releasing a ${radius}px slowing burst on frozen kills`,
		"stasis_burst_upg1",
		32 + index * 9,
		{ projectileStasisRadius: radius }
	)),
}

export const volatileCorrosion: UpgradeDefinition = {
	toolKey: "volatileCorrosion",
	toolName: "Volatile corrosion",
	category: "combat",
	type: "passive",
	requirements: { allOf: [{ toolKey: "corrosivePayload" }] },
	levels: [55, 75, 100].map((radius, index) => level(
		index,
		`${chanceLabel(index)}% chance for corrosive rounds to become volatile, exploding in a ${radius}px cloud for ${[100, 175, 250][index]}% projectile damage and spreading corrosion`,
		"volatile_corrosion_upg1",
		36 + index * 10,
		{
			projectileVolatileRadius: radius,
			projectileVolatileDamage: [1, 1.75, 2.5][index],
		}
	)),
}

export const criticalShatter: UpgradeDefinition = {
	toolKey: "criticalShatter",
	toolName: "Critical shatter",
	category: "combat",
	type: "passive",
	requirements: { allOf: [{ toolKey: "targetingMatrix" }] },
	levels: [2, 3, 4].map((count, index) => level(
		index,
		`${chanceLabel(index)}% chance to load shatter rounds whose critical hits release ${count} penetrating shards dealing ${35 + index * 5}% projectile damage each`,
		"critical_shatter_upg1",
		34 + index * 9,
		{
			projectileCriticalShards: count,
			projectileCriticalShardDamage: 0.35 + index * 0.05,
		}
	)),
}

export const executionRounds: UpgradeDefinition = {
	toolKey: "executionRounds",
	toolName: "Execution rounds",
	category: "combat",
	type: "passive",
	levels: [1.4, 1.65, 1.9].map((damageRatio, index) => level(
		index,
		`${chanceLabel(index)}% chance to load execution rounds that deal ${Math.round(damageRatio * 100)}% projectile damage to enemies below ${[25, 30, 35][index]}% health`,
		"execution_rounds_upg1",
		24 + index * 7,
		{
			projectileExecutionDamage: damageRatio,
			projectileExecutionThreshold: [0.25, 0.3, 0.35][index],
		}
	)),
}

export const targetPainter: UpgradeDefinition = {
	toolKey: "targetPainter",
	toolName: "Target painter",
	category: "combat",
	type: "passive",
	levels: [0.08, 0.12, 0.16].map((bonus, index) => level(
		index,
		`${chanceLabel(index)}% chance to load painter rounds that mark targets for ${Math.round(bonus * 100)}% bonus damage per stack`,
		"target_painter_upg1",
		26 + index * 8,
		{
			projectilePaintDamage: bonus,
			projectilePaintStacks: 3 + index,
		}
	)),
}

export const mineLayer: UpgradeDefinition = {
	toolKey: "mineLayer",
	toolName: "Mine layer",
	category: "combat",
	type: "passive",
	levels: [2.5, 3.5, 4.5].map((duration, index) => {
		return level(
			index,
			`${chanceLabel(index)}% chance to load a mine-layer round that deploys 5 mines from your ship over 3 seconds after travelling 100px, dealing ${70 + index * 10}% projectile damage each`,
			"mine_layer_upg1",
			30 + index * 9,
			{
				projectileMineDuration: duration,
				projectileMineDamage: 0.7 + index * 0.1,
			}
		)
	}),
}

export const voidLance: UpgradeDefinition = {
	toolKey: "voidLance",
	toolName: "Void lance",
	category: "combat",
	type: "passive",
	levels: [4, 7, 10].map((pierces, index) => level(
		index,
		`${chanceLabel(index)}% chance to load void lances that phase through ${pierces} extra targets with high damage retention`,
		"void_lance_upg1",
		38 + index * 11,
		{ projectilePhasePierces: pierces }
	)),
}
