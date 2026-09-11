import type { HubLiveCircuitStampDefinition } from "./hubPuzzleStampTypes"

export const HUB_LIVE_CIRCUIT_STAMP: HubLiveCircuitStampDefinition = {
	id: "hub-live-circuit",
	type: "live-circuit",
	title: "LIVE CIRCUIT",
	purposes: ["puzzle", "physics"],
	minimumHubLevel: 1,
	bounds: { width: 420, height: 330 },
	headerOffset: [0, -150],
	rewardOffset: [0, -18],
	sourceCoilOffset: [-132, 0],
	targetCoilOffset: [132, 0],
	linkDistance: 88,
	conductors: [
		{
			id: "southwest-conductor",
			offset: [-60, 82],
			sprite: "enemy_hunter_talon_left_wing",
			angle: 0,
			scale: 0.9,
			radius: 12,
			mass: 1.35,
		},
		{
			id: "north-conductor",
			offset: [0, -78],
			sprite: "enemy_fighter_core",
			angle: 97,
			scale: 0.9,
			radius: 12,
			mass: 1.35,
		},
		{
			id: "southeast-conductor",
			offset: [64, 86],
			sprite: "enemy_hunter_carapace_right_wing",
			angle: 194,
			scale: 0.9,
			radius: 12,
			mass: 1.35,
		},
	],
}
