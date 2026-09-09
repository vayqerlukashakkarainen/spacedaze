import { getCurrentRunFloor } from "../services/runDirectorService"
import { k } from "../main"
import type { Level } from "./levels"
import { clearGeneratedRunMap } from "./runMap"
import { RUN_ROCK_PROJECTION_Y_SCALE } from "./runRockTiles"
import { getActiveRoomFloor } from "../services/roomFloorService"
import { showFloorThemeTitle } from "../ui/floorThemeTitle"
import {
	clearGeneratedRoomFloor,
	startGeneratedRoomFloor,
} from "./roomFloorRuntime"

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
		clearGeneratedRoomFloor()
		clearGeneratedRunMap()
	},
	onStart: () => {
		const floor = getCurrentRunFloor()
		startGeneratedRoomFloor(
			level2.mapGeneration!,
			floor?.mapSeed ?? Math.floor(k.rand(1, 1000000)),
			floor?.depth ?? 1
		)
		const roomFloor = getActiveRoomFloor()
		if (roomFloor) showFloorThemeTitle(roomFloor.themeId, roomFloor.depth)
	},
	// Level-specific events will be authored after the base layout is tested.
	lvlUpd: () => {},
}
