import type { RoomStampDefinition } from "../roomStampTypes"

export const SPAWNER_MAZE_STAMP: RoomStampDefinition = {
	id: "spawner-maze",
	mode: "primary",
	purposes: ["combat", "traversal"],
	compatibility: {
		roomKinds: ["combat"],
		minimumSubfloor: 1,
		minimumDistanceFromStart: 2,
		minimumRoomRadius: 5,
		minimumConnections: 2,
		maximumConnections: 4,
	},
	selection: {
		weight: 1,
		repeatCooldown: 2,
		allowMirroring: false,
		allowedRotations: [0, 1, 2, 3, 4, 5],
	},
	ports: {
		requiredDirections: [],
		exact: false,
	},
	cells: [
		{ coord: { q: 2, r: 0 }, terrain: "wall" },
		{ coord: { q: 2, r: -2 }, terrain: "wall" },
		{ coord: { q: 1, r: -2 }, terrain: "wall" },
		{ coord: { q: 0, r: -2 }, terrain: "wall" },
		{ coord: { q: -2, r: 0 }, terrain: "wall" },
		{ coord: { q: -2, r: 2 }, terrain: "wall" },
		{ coord: { q: -1, r: 2 }, terrain: "wall" },
		{ coord: { q: 0, r: 2 }, terrain: "wall" },
		{ coord: { q: 3, r: -1 }, terrain: "wall" },
		{ coord: { q: -3, r: 1 }, terrain: "wall" },
	],
	mechanics: [],
	contentSlots: [
		{
			id: "center-spawner",
			type: "enemy-spawner",
			coord: { q: 0, r: 0 },
			required: true,
			encounterPolicy: "anchor",
			wave: 0,
			requirements: {
				maximumFootprintRadius: 1,
				mobility: ["stationary", "mobile"],
				delivery: ["ground", "phase", "portal"],
				maximumPlacementCost: 5,
			},
		},
	],
	validation: {
		connectAllDoors: true,
		minimumSpawnSlots: 4,
		preserveDoorRoutes: false,
	},
}
