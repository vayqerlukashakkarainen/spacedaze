import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import type { RoomFloorRoom } from "../../generation/rooms/roomFloorTypes"
import type { ProgressionEnemyId } from "../../services/enemies/enemyProgressionService"
import { SPAWNER_MAZE_STAMP } from "./spawnerMazeStamp"
import { getCompatibleCombatSpawnerProfiles } from "./combatSpawnerProfileCatalog"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

function makeRoom(
	tier: number,
	difficultyBudget: number,
	enemyIds: ProgressionEnemyId[]
): RoomFloorRoom {
	return {
		id: "room-0-0",
		coord: { q: 0, r: 0 },
		kind: "combat",
		templateId: "combat",
		seed: 1,
		distanceFromStart: 3,
		connections: ["room-1-0", "room--1-0"],
		state: "unseen",
		contentCompleted: false,
		encounter: {
			id: "test-encounter",
			tier,
			difficultyBudget,
			rewardTier: 1,
			enemies: enemyIds.map((enemyId, index) => ({
				id: `enemy-${index}`,
				enemyId,
				wave: 0,
				spawnSlot: index,
				elite: false,
				defeated: false,
			})),
		},
	}
}

const slot = SPAWNER_MAZE_STAMP.contentSlots[0]
const wakeProfiles = getCompatibleCombatSpawnerProfiles(
	slot,
	makeRoom(4, 9, ["wake-scrap-raiser"]),
	"wake-scrap-district"
).map((profile) => profile.id)
assert(
	wakeProfiles.includes("scrappers-hut") && wakeProfiles.includes("scrap-raiser"),
	"A high-threat Wake maze should support both stationary and encounter-owned spawners"
)

const swarmProfiles = getCompatibleCombatSpawnerProfiles(
	slot,
	makeRoom(3, 9, ["hivemind", "swarm-drone"]),
	"freebooter-exchange"
).map((profile) => profile.id)
assert(
	swarmProfiles.length === 1 && swarmProfiles[0] === "swarm-hivemind",
	"A compatible non-Wake encounter should resolve to its swarm controller"
)

function hasProfiles(
	themeId: FloorThemeId,
	tier: number,
	budget: number,
	enemies: Parameters<typeof makeRoom>[2]
) {
	return getCompatibleCombatSpawnerProfiles(
		slot,
		makeRoom(tier, budget, enemies),
		themeId
	).length > 0
}

assert(
	!hasProfiles("freebooter-exchange", 3, 9, ["swarm-drone"]),
	"The resolver must not inject a controller that was not budgeted by the encounter"
)
assert(
	!hasProfiles("wake-scrap-district", 4, 2, ["wake-scrap-raiser"]),
	"The resolver must reject spawners that exceed the room budget"
)

console.log("Combat spawner profile tests passed")
