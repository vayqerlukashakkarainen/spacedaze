import type { FloorThemeId } from "../../levels/floorThemes/floorThemeDirectory"
import type { ProgressionEnemyId } from "../../services/enemies/enemyProgressionService"
import type {
	RoomFloorRoom,
	RoomStampSpawnerProfileId,
} from "../../generation/rooms/roomFloorTypes"
import type {
	RoomStampEnemySpawnerSlot,
	RoomStampSpawnerDelivery,
	RoomStampSpawnerMobility,
} from "../roomStampTypes"

export interface CombatSpawnerProfile {
	id: RoomStampSpawnerProfileId
	enemyId: ProgressionEnemyId
	themes: readonly FloorThemeId[]
	minimumThreatTier: number
	maximumThreatTier: number
	footprintRadius: number
	mobility: RoomStampSpawnerMobility
	delivery: RoomStampSpawnerDelivery
	placementCost: number
	weight: number
	requiresExistingEnemy: boolean
	minimumCompanions?: {
		enemyId: ProgressionEnemyId
		count: number
	}
}

const NON_WAKE_THEMES: readonly FloorThemeId[] = [
	"freebooter-exchange",
	"khelt-moltworks",
	"oruun-pilgrim-array",
	"naru-tide-ark",
	"silex-resonance-vault",
	"vey-living-convoy",
	"federation-claim-zone",
	"daze-scar",
]

export const COMBAT_SPAWNER_PROFILE_CATALOG: Readonly<
	Record<RoomStampSpawnerProfileId, CombatSpawnerProfile>
> = {
	"scrappers-hut": {
		id: "scrappers-hut",
		enemyId: "wake-scrappers-hut",
		themes: ["wake-scrap-district"],
		minimumThreatTier: 1,
		maximumThreatTier: 5,
		footprintRadius: 1,
		mobility: "stationary",
		delivery: "ground",
		placementCost: 3,
		weight: 1.25,
		requiresExistingEnemy: false,
	},
	"scrap-raiser": {
		id: "scrap-raiser",
		enemyId: "wake-scrap-raiser",
		themes: ["wake-scrap-district"],
		minimumThreatTier: 3,
		maximumThreatTier: 5,
		footprintRadius: 0,
		mobility: "mobile",
		delivery: "ground",
		placementCost: 3,
		weight: 0.85,
		requiresExistingEnemy: true,
	},
	"swarm-hivemind": {
		id: "swarm-hivemind",
		enemyId: "hivemind",
		themes: NON_WAKE_THEMES,
		minimumThreatTier: 2,
		maximumThreatTier: 5,
		footprintRadius: 0,
		mobility: "mobile",
		delivery: "phase",
		placementCost: 4,
		weight: 1,
		requiresExistingEnemy: true,
		minimumCompanions: {
			enemyId: "swarm-drone",
			count: 3,
		},
	},
}

export function getCompatibleCombatSpawnerProfiles(
	slot: RoomStampEnemySpawnerSlot,
	room: RoomFloorRoom,
	themeId: FloorThemeId
) {
	const tier = room.encounter?.tier ?? 1
	const budget = room.encounter?.difficultyBudget ?? 0
	return Object.values(COMBAT_SPAWNER_PROFILE_CATALOG).filter((profile) => {
		if (!profile.themes.includes(themeId)) return false
		if (
			tier < profile.minimumThreatTier ||
			tier > profile.maximumThreatTier
		) return false
		if (profile.footprintRadius > slot.requirements.maximumFootprintRadius) {
			return false
		}
		if (!slot.requirements.mobility.includes(profile.mobility)) return false
		if (!slot.requirements.delivery.includes(profile.delivery)) return false
		if (profile.placementCost > slot.requirements.maximumPlacementCost) return false
		if (profile.placementCost > budget) return false
		if (
			profile.requiresExistingEnemy &&
			!room.encounter?.enemies.some((enemy) =>
				enemy.enemyId === profile.enemyId && !enemy.defeated
			)
		) return false
		return true
	})
}
