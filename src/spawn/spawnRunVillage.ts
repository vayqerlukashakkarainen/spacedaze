import type { HexGrid } from "../grid/hexGrid"
import { k, layers } from "../main"
import type { RunVillageZone } from "../services/runVillageService"
import { tags } from "../tags"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth"

interface RunVillageArchetype {
	buildingSprite: string
	destroyedSprite?: string
	buildingOffsetY: number
	scale: number
}

const RUN_VILLAGE_ARCHETYPES: readonly RunVillageArchetype[] = [
	{ buildingSprite: "hub_building_service_kiosk", buildingOffsetY: -14, scale: 0.8 },
	{ buildingSprite: "hub_building_courier_depot", buildingOffsetY: -16, scale: 0.72 },
	{ buildingSprite: "hub_building_scrap_sorter", buildingOffsetY: -22, scale: 0.62 },
	{ buildingSprite: "hub_building_smelter_annex", destroyedSprite: "hub_building_smelter_annex_destroyed", buildingOffsetY: -30, scale: 0.56 },
	{ buildingSprite: "hub_building_listening_post", destroyedSprite: "hub_building_listening_post_destroyed", buildingOffsetY: -36, scale: 0.58 },
	{ buildingSprite: "hub_building_repair_drydock", destroyedSprite: "hub_building_repair_drydock_destroyed", buildingOffsetY: -16, scale: 0.48 },
	{ buildingSprite: "hub_building_fuel_farm", destroyedSprite: "hub_building_fuel_farm_destroyed", buildingOffsetY: -22, scale: 0.48 },
	{ buildingSprite: "hub_building_freight_terminal", destroyedSprite: "hub_building_freight_terminal_destroyed", buildingOffsetY: -20, scale: 0.42 },
]

export function spawnRunVillages(grid: HexGrid, zones: RunVillageZone[]) {
	for (const zone of zones) {
		for (const plot of zone.plots) {
			const archetype = RUN_VILLAGE_ARCHETYPES[plot.archetype]
			if (!archetype) continue
			const position = grid.hexToScreen(plot.coord)
			const facing = plot.mirrored ? -1 : 1
			const scale = archetype.scale
			const useDestroyedSprite =
				plot.destroyed && archetype.destroyedSprite !== undefined
			const buildingSprite = useDestroyedSprite
				? archetype.destroyedSprite
				: archetype.buildingSprite
			const building = k.add([
				k.pos(position.add(0, archetype.buildingOffsetY * scale)),
				k.sprite(buildingSprite),
				k.anchor("center"),
				k.scale(facing * scale, scale),
				k.color(255, 255, 255),
				k.layer(layers.game),
				k.z(-20),
				tags.props,
				tags.runMap,
				tags.gameLoop,
				tags.runtimeCullable,
			])
			addBuildingPlayerDepth(building)
		}
	}
}
