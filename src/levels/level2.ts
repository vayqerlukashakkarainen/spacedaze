import { getCurrentRunFloor } from "../services/runDirectorService"
import { k } from "../main"
import type { Level } from "./levels"
import { RUN_ROCK_PROJECTION_Y_SCALE } from "./runRockTiles"
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
	},
	reset: () => {
		clearGeneratedRoomFloor()
	},
	onStart: () => {
		const floor = getCurrentRunFloor()
		startGeneratedRoomFloor(
			level2.mapGeneration!,
			floor?.mapSeed ?? Math.floor(k.rand(1, 1000000)),
			floor?.depth ?? 1
		)
	},
	// Level-specific events will be authored after the base layout is tested.
	lvlUpd: () => {},
}
