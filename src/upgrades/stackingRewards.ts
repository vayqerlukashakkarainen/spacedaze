import { Tool } from "../upg"

export const tacticalUplink = stackingTool(
	"Tactical uplink",
	"Tactical Uplink",
	"Deal more damage to enemies near full hull",
	"tactical_uplink_upg1",
	[1.4, 1.7, 2, 2.3, 2.6]
)

export const phaseCounter = stackingTool(
	"Phase counter",
	"Phase Counter",
	"Grazing hostile fire stores an empowered shot",
	"phase_counter_upg1",
	[1, 2, 3, 4, 5]
)

export const threatReactor = stackingTool(
	"Threat reactor",
	"Threat Reactor",
	"Raise threat and increase salvage rewards",
	"threat_reactor_upg1",
	[1, 2, 3, 4, 5]
)

export const resonanceCoil = stackingTool(
	"Resonance coil",
	"Resonance Coil",
	"Heavy projectile hits discharge a percentage of the triggering hit",
	"resonance_coil_upg1",
	[1, 2, 3, 4, 5]
)

export const wreckHarvester = stackingTool(
	"Wreck harvester",
	"Wreck Harvester",
	"Destroyed enemies launch two seeking shards scaled from primary damage",
	"wreck_harvester_upg1",
	[0.5, 0.75, 1, 1.25, 1.5]
)

function stackingTool(
	toolName: string,
	name: string,
	desc: string,
	sprite: string,
	values: number[]
): Tool {
	return {
		toolName,
		upgrades: values.map((value, index) => ({
			name,
			desc: `${desc}. Stack ${index + 1}/${values.length}`,
			sprite,
			price: 28 + index * 8,
			value,
		})),
	}
}
