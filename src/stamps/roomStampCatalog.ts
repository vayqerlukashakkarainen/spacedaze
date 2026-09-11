import type { RoomStampId } from "../generation/rooms/roomFloorTypes"
import { BLASTER_CORRIDOR_STAMP } from "./combat/blasterCorridorStamp"
import { SPAWNER_MAZE_STAMP } from "./combat/spawnerMazeStamp"
import { OUTER_COVER_POCKET_STAMP } from "./combat/outerCoverPocketStamp"
import { SALVAGE_RELAY_STAMP } from "./reward/salvageRelayStamp"
import type { RoomStampDefinition } from "./roomStampTypes"

export const ROOM_STAMP_CATALOG: Readonly<
	Record<RoomStampId, RoomStampDefinition>
> = {
	"blaster-corridor": BLASTER_CORRIDOR_STAMP,
	"spawner-maze": SPAWNER_MAZE_STAMP,
	"outer-cover-pocket": OUTER_COVER_POCKET_STAMP,
	"salvage-relay": SALVAGE_RELAY_STAMP,
}

export function getRoomStampDefinition(id: RoomStampId) {
	return ROOM_STAMP_CATALOG[id]
}
