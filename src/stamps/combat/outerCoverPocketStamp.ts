import type { RoomStampDefinition } from "../roomStampTypes"

export const OUTER_COVER_POCKET_STAMP: RoomStampDefinition = {
	id: "outer-cover-pocket",
	mode: "overlay",
	purposes: ["combat", "traversal"],
	compatibility: {
		roomKinds: ["combat"],
		minimumSubfloor: 1,
		minimumDistanceFromStart: 2,
		minimumRoomRadius: 6,
		minimumConnections: 1,
		maximumConnections: 4,
	},
	selection: {
		weight: 1,
		repeatCooldown: 1,
		allowMirroring: false,
		allowedRotations: [0, 1, 2, 3, 4, 5],
	},
	ports: {
		requiredDirections: [],
		exact: false,
	},
	cells: [
		{ coord: { q: 5, r: -2 }, terrain: "wall" },
		{ coord: { q: 5, r: -3 }, terrain: "wall" },
		{ coord: { q: 4, r: -3 }, terrain: "wall" },
	],
	mechanics: [],
	contentSlots: [],
	validation: {
		connectAllDoors: true,
		minimumSpawnSlots: 4,
		preserveDoorRoutes: true,
	},
}
