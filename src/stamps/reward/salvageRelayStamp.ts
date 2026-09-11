import type {
	RoomStampCell,
	RoomStampDefinition,
} from "../roomStampTypes"

export const SALVAGE_RELAY_STAMP: RoomStampDefinition = {
	id: "salvage-relay",
	mode: "primary",
	purposes: ["reward"],
	compatibility: {
		roomKinds: ["deposit"],
		minimumRoomRadius: 5,
		minimumConnections: 1,
		maximumConnections: 6,
	},
	selection: {
		weight: 1,
		repeatCooldown: 0,
		required: true,
		allowMirroring: false,
		allowedRotations: [0],
	},
	ports: {
		requiredDirections: [],
		exact: false,
	},
	cells: createRelayGroundFootprint(),
	mechanics: [
		{
			type: "world-object-anchor",
			objectId: "debris-deposit",
			coord: { q: 0, r: 0 },
		},
	],
	contentSlots: [],
	validation: {
		connectAllDoors: true,
		minimumSpawnSlots: 4,
		preserveDoorRoutes: true,
	},
}

function createRelayGroundFootprint(): RoomStampCell[] {
	const cells: RoomStampCell[] = []
	for (let q = -2; q <= 2; q++) {
		for (let r = -2; r <= 2; r++) {
			const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r))
			if (distance <= 2) cells.push({ coord: { q, r }, terrain: "open" })
		}
	}
	return cells
}
