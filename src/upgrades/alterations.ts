import type { UpgradeDefinition, UpgradeRequirements } from "../types/upgradeTypes"

interface AlterationConfig {
	toolKey: string
	toolName: string
	description: string
	sprite: string
	requirements: UpgradeRequirements
}

function alteration(config: AlterationConfig): UpgradeDefinition {
	return {
		toolKey: config.toolKey,
		toolName: config.toolName,
		category: "alteration",
		type: "passive",
		alteration: true,
		requirements: config.requirements,
		levels: [{
			name: config.toolName,
			desc: config.description,
			price: 0,
			sprite: config.sprite,
			effects: {
				unlocks: [{
					unlockId: config.toolKey,
					description: config.description,
				}],
			},
		}],
	}
}

export const arcHarpoonDefinition = alteration({
	toolKey: "arcHarpoon",
	toolName: "Arc Harpoon",
	description: "A tethered target is repeatedly shocked. Tethered wreckage conducts the arc into nearby enemies.",
	sprite: "arc_harpoon_upg1",
	requirements: {
		allOf: [
			{ toolKey: "salvageLasso" },
			{ toolKey: "stunRounds" },
		],
	},
})

export const shrapnelGardenDefinition = alteration({
	toolKey: "shrapnelGarden",
	toolName: "Shrapnel Garden",
	description: "Deployed mines burst into a radial volley carrying the shot's projectile modifiers.",
	sprite: "shrapnel_garden_upg1",
	requirements: {
		allOf: [
			{ toolKey: "mineLayer" },
			{ toolKey: "splitChamber" },
		],
	},
})

export const huntersGeometryDefinition = alteration({
	toolKey: "huntersGeometry",
	toolName: "Hunter's Geometry",
	description: "Perfect Strafe Mode aim gains stronger guidance, +20% critical chance, and two penetrations.",
	sprite: "hunters_geometry_upg1",
	requirements: {
		allOf: [
			{ toolKey: "tacticalUplink" },
			{ toolKey: "hunterGuidance" },
		],
	},
})

export const graviticImpalerDefinition = alteration({
	toolKey: "graviticImpaler",
	toolName: "Gravitic Impaler",
	description: "Slinging through an enemy marks it. The next Rail Lance curves toward it and gains damage from release speed.",
	sprite: "gravitic_impaler_upg1",
	requirements: {
		allOf: [
			{ toolKey: "gravitySling" },
			{ toolKey: "railLance" },
		],
	},
})

function legacyTool(definition: UpgradeDefinition) {
	return {
		toolName: definition.toolName,
		requirements: definition.requirements,
		upgrades: definition.levels.map((level) => ({
			name: level.name,
			desc: level.desc,
			price: level.price,
			sprite: level.sprite,
			value: 1,
		})),
	}
}

export const arcHarpoon = legacyTool(arcHarpoonDefinition)
export const shrapnelGarden = legacyTool(shrapnelGardenDefinition)
export const huntersGeometry = legacyTool(huntersGeometryDefinition)
export const graviticImpaler = legacyTool(graviticImpalerDefinition)
