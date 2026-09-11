import type {
	RoomFloorKind,
	RoomFloorRoom,
	RoomIntelLevel,
} from "../../generation/rooms/roomFloorTypes"

export type RoomSignalFamily =
	| "threat"
	| "upgrade"
	| "recovery"
	| "salvage"
	| "deposit"
	| "shop"
	| "shrine"
	| "traversal"
	| "event"
	| "exit"

export const ROOM_SIGNAL_SPRITE = "route_signals"
export const ROUTE_RESONANCE_FIRST_FRAME = 10
export const ROUTE_RESONANCE_FRAME_COUNT = 5

const ROOM_SIGNAL_FRAMES: Record<RoomSignalFamily, number> = {
	threat: 0,
	upgrade: 1,
	recovery: 2,
	salvage: 3,
	deposit: 4,
	shop: 5,
	shrine: 6,
	traversal: 7,
	event: 8,
	exit: 9,
}

export function getRoomIntelLevel(room: RoomFloorRoom): RoomIntelLevel {
	if (room.state === "active" || room.state === "cleared") return 3
	if (room.mapIdentityRevealed === true) return 3
	return room.intelLevel ?? (room.state === "discovered" ? 1 : 0)
}

export function getRoomSignalFamily(kind: RoomFloorKind): RoomSignalFamily {
	if (kind === "combat" || kind === "miniBoss" || kind === "boss") return "threat"
	if (kind === "reward" || kind === "lassoComponent") return "upgrade"
	if (kind === "health") return "recovery"
	if (kind === "deposit") return "deposit"
	if (kind === "shop" || kind === "droneShop") return "shop"
	if (kind === "shrine") return "shrine"
	if (kind === "gravity" || kind === "cargoPuzzleTarget") return "traversal"
	if (
		kind === "scrapCircuit" ||
		kind === "lassoTrial" ||
		kind === "thrusterPuzzle" ||
		kind === "cargoPuzzleSource"
	) return "salvage"
	if (kind === "exit" || kind === "start" || kind === "chill") return "exit"
	return "event"
}

export function getRoomSignalFrame(room: RoomFloorRoom) {
	return ROOM_SIGNAL_FRAMES[getRoomSignalFamily(room.kind)]
}

export function getRouteResonanceFrame(time: number) {
	return ROUTE_RESONANCE_FIRST_FRAME + Math.floor(time * 8) %
		ROUTE_RESONANCE_FRAME_COUNT
}

export function getRoomSignalLabel(room: RoomFloorRoom) {
	return {
		threat: "HOSTILE SIGNAL",
		upgrade: "UPGRADE SIGNAL",
		recovery: "RECOVERY SIGNAL",
		salvage: "SALVAGE SIGNAL",
		deposit: "DEPOSIT SIGNAL",
		shop: "TRADE SIGNAL",
		shrine: "SHRINE SIGNAL",
		traversal: "PHASE SIGNAL",
		event: "UNKNOWN EVENT",
		exit: "EXIT SIGNAL",
	}[getRoomSignalFamily(room.kind)]
}

export function getRoomThreatRating(room: RoomFloorRoom): 1 | 2 | 3 {
	if (room.dangerLevel) return room.dangerLevel
	if (room.kind === "boss" || room.kind === "miniBoss") return 3
	const tier = room.encounter?.tier ?? 1
	return tier >= 4 ? 3 : tier >= 2 ? 2 : 1
}
