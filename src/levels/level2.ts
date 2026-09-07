import { getCurrentRunFloor } from "../services/runDirectorService"
import type { Level } from "./levels"
import { clearGeneratedRunMap, startGeneratedRunMap } from "./runMap"
import { RUN_ROCK_PROJECTION_Y_SCALE } from "./runRockTiles"

export const level2: Level = {
	mapGeneration: {
		width: 48,
		height: 36,
		hexSize: 96,
		projectionYScale: RUN_ROCK_PROJECTION_Y_SCALE,
		generator: {
			fill: { percentage: 0.44 },
			ca: { iterations: 4 },
			features: {
				resourceNodeCount: 6,
				hazardCount: 3,
				minPoiSpacing: 6,
			},
		},
	},
	reset: () => {
		clearGeneratedRunMap()
	},
	onStart: () => {
		startGeneratedRunMap(
			level2.mapGeneration!,
			getCurrentRunFloor()?.mapSeed
		)
	},
	// Level-specific events will be authored after the base layout is tested.
	lvlUpd: () => {},
}
