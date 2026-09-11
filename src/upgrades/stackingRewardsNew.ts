import { UpgradeDefinition, UpgradeLevel } from "../types/upgradeTypes"

export const tacticalUplink = stackingDefinition({
	toolKey: "tacticalUplink",
	toolName: "Tactical uplink",
	category: "combat",
	name: "Tactical Uplink",
	desc: "Deal more damage to enemies at 90% hull or higher",
	sprite: "tactical_uplink_upg1",
	stat: "tacticalUplinkMultiplier",
	values: [1.4, 1.7, 2, 2.3, 2.6],
})

export const phaseCounter = stackingDefinition({
	toolKey: "phaseCounter",
	toolName: "Phase counter",
	category: "special",
	name: "Phase Counter",
	desc: "Grazing hostile fire stores an empowered shot; stacks add capacity",
	sprite: "phase_counter_upg1",
	stat: "phaseCounterCapacity",
	values: [1, 2, 3, 4, 5],
})

export const threatReactor = stackingDefinition({
	toolKey: "threatReactor",
	toolName: "Threat reactor",
	category: "resources",
	name: "Threat Reactor",
	desc: "Raise threat by one tier and gain 25% more salvage per stack",
	sprite: "threat_reactor_upg1",
	stat: "threatReactorStacks",
	values: [1, 2, 3, 4, 5],
})

export const resonanceCoil = stackingDefinition({
	toolKey: "resonanceCoil",
	toolName: "Resonance coil",
	category: "combat",
	name: "Resonance Coil",
	desc: "Heavy hits discharge a shock ring for a percentage of the triggering hit; stacks improve it",
	sprite: "resonance_coil_upg1",
	stat: "resonanceCoilStacks",
	values: [1, 2, 3, 4, 5],
})

export const wreckHarvester = stackingDefinition({
	toolKey: "wreckHarvester",
	toolName: "Wreck harvester",
	category: "combat",
	name: "Wreck Harvester",
	desc: "Destroyed enemies launch two seeking shards; stacks raise their primary-damage ratio",
	sprite: "wreck_harvester_upg1",
	stat: "wreckHarvesterDamageRatio",
	values: [0.5, 0.75, 1, 1.25, 1.5],
})

function stackingDefinition(config: {
	toolKey: string
	toolName: string
	category: UpgradeDefinition["category"]
	name: string
	desc: string
	sprite: string
	stat: string
	values: number[]
}): UpgradeDefinition {
	return {
		toolKey: config.toolKey,
		toolName: config.toolName,
		category: config.category,
		type: "passive",
		levels: config.values.map((value, index): UpgradeLevel => ({
			name: config.name,
			desc: `${config.desc}. Stack ${index + 1}/${config.values.length}`,
			sprite: config.sprite,
			price: 28 + index * 8,
			effects: {
				modifiers: [{ stat: config.stat, value, type: "base" }],
			},
		})),
	}
}
