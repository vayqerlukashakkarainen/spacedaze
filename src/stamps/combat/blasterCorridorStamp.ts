import type {
	RoomStampCell,
	RoomStampDefinition,
} from "../roomStampTypes"

export const BLASTER_CORRIDOR_STAMP: RoomStampDefinition = {
	id: "blaster-corridor",
	mode: "primary",
	purposes: ["combat", "traversal", "hazard"],
	compatibility: {
		roomKinds: ["combat"],
		minimumSubfloor: 1,
		minimumDistanceFromStart: 2,
		minimumRoomRadius: 5,
		minimumConnections: 2,
		maximumConnections: 2,
	},
	selection: {
		weight: 1.2,
		repeatCooldown: 2,
		allowMirroring: false,
		allowedRotations: [0, 1, 2, 3, 4, 5],
	},
	ports: {
		requiredDirections: [0],
		exact: false,
	},
	cells: createCorridorCells(),
	mechanics: [
		{
			type: "projectile-emitter",
			coord: { q: 3, r: -1 },
			facing: 3,
			interval: 1.45,
			phase: 0,
		},
		{
			type: "projectile-emitter",
			coord: { q: 3, r: 0 },
			facing: 3,
			interval: 1.45,
			phase: 0.22,
		},
		{
			type: "projectile-emitter",
			coord: { q: 2, r: 1 },
			facing: 3,
			interval: 1.45,
			phase: 0.44,
		},
	],
	contentSlots: [],
	validation: {
		connectAllDoors: true,
		minimumSpawnSlots: 4,
		preserveDoorRoutes: true,
	},
}

function createCorridorCells(): RoomStampCell[] {
	const cells: RoomStampCell[] = []
	for (let q = -4; q <= 4; q++) {
		for (let r = -4; r <= 4; r++) {
			const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r))
			if (distance >= 5 || Math.abs(r) <= 1) continue
			cells.push({ coord: { q, r }, terrain: "wall" })
		}
	}
	return cells
}
