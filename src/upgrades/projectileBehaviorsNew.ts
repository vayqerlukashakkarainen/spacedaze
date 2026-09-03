import type { UpgradeDefinition, UpgradeLevel } from "../types/upgradeTypes"

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
			modifiers: Object.entries(stats).map(([stat, value]) => ({
				stat,
				value,
				type: "base",
			})),
		},
	}
}

export const fragmentationCore: UpgradeDefinition = {
	toolKey: "fragmentationCore",
	toolName: "Fragmentation core",
	category: "combat",
	type: "passive",
	levels: [3, 4, 5].map((count, index) => level(
		index,
		`Destroyed projectiles burst into ${count} short-lived fragments`,
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
		`Projectiles steer toward enemies within ${distance}px with ${index + 1} guidance strength`,
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
		`Near misses detonate within ${radius}px and damage clustered enemies`,
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
		`Shots repeat ${count} ${count === 1 ? "time" : "times"} from their firing point`,
		"afterimage_rounds_upg1",
		32 + index * 10,
		{
			projectileEchoCount: count,
			projectileEchoDamage: 0.4 + index * 0.05,
		}
	)),
}

export const boomerangPayload: UpgradeDefinition = {
	toolKey: "boomerangPayload",
	toolName: "Boomerang payload",
	category: "combat",
	type: "passive",
	levels: [0.58, 0.72, 0.86].map((speed, index) => level(
		index,
		`Projectiles loop back after ${[0.7, 0.62, 0.54][index]} seconds at ${Math.round(speed * 100)}% speed`,
		"boomerang_payload_upg1",
		26 + index * 8,
		{
			projectileReturnSpeed: speed,
			projectileReturnDelay: [0.7, 0.62, 0.54][index],
		}
	)),
}

export const growingCharge: UpgradeDefinition = {
	toolKey: "growingCharge",
	toolName: "Growing charge",
	category: "combat",
	type: "passive",
	levels: [1.45, 1.7, 2].map((damage, index) => level(
		index,
		`Shots grow with distance, reaching ${damage}x damage`,
		"growing_charge_upg1",
		24 + index * 8,
		{
			projectileGrowthDamage: damage,
			projectileGrowthScale: 1.35 + index * 0.2,
		}
	)),
}

export const momentumCore: UpgradeDefinition = {
	toolKey: "momentumCore",
	toolName: "Momentum core",
	category: "combat",
	type: "passive",
	levels: [180, 280, 400].map((acceleration, index) => level(
		index,
		`Projectiles accelerate by ${acceleration} speed per second`,
		"momentum_core_upg1",
		20 + index * 6,
		{ projectileAcceleration: acceleration }
	)),
}

export const orbitingRounds: UpgradeDefinition = {
	toolKey: "orbitingRounds",
	toolName: "Orbiting rounds",
	category: "combat",
	type: "passive",
	levels: [8, 13, 18].map((radius, index) => level(
		index,
		`Shots spiral around their trajectory with a ${radius}px orbit`,
		"orbiting_rounds_upg1",
		25 + index * 7,
		{ projectileOrbitRadius: radius }
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
		`Frozen kills release a ${radius}px slowing burst`,
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
		`Corroded enemies explode in a ${radius}px cloud and spread corrosion`,
		"volatile_corrosion_upg1",
		36 + index * 10,
		{
			projectileVolatileRadius: radius,
			projectileVolatileDamage: 2 + index * 1.5,
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
		`Critical hits release ${count} penetrating shards`,
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
	levels: [1.4, 1.65, 1.9].map((damage, index) => level(
		index,
		`Deal ${damage}x damage to enemies below ${[25, 30, 35][index]}% health`,
		"execution_rounds_upg1",
		24 + index * 7,
		{
			projectileExecutionDamage: damage,
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
		`Hits mark targets for ${Math.round(bonus * 100)}% bonus damage per stack`,
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
		const chance = [0.12, 0.18, 0.24][index]
		return level(
		index,
		`${Math.round(chance * 100)}% chance after 100px to place a mine that arms after 2 seconds`,
		"mine_layer_upg1",
		30 + index * 9,
		{
			projectileMineDuration: duration,
			projectileMineChance: chance,
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
		`Shots phase through ${pierces} extra targets with high damage retention`,
		"void_lance_upg1",
		38 + index * 11,
		{ projectilePhasePierces: pierces }
	)),
}
