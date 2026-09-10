import type { HexGrid } from "../grid/hexGrid"
import { k, layers } from "../main"
import type { RunVillageZone } from "../services/runs/runVillageService"
import { tags } from "../tags"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth"
import { RUN_VILLAGE_VISUALS } from "../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"

export function spawnRunVillages(grid: HexGrid, zones: RunVillageZone[]) {
	for (const zone of zones) {
		for (const plot of zone.plots) {
			const archetype = RUN_VILLAGE_VISUALS[plot.archetype]
			if (!archetype) continue
			const position = grid.hexToScreen(plot.coord)
			const facing = plot.mirrored ? -1 : 1
			const scale = archetype.worldScale
			const useDestroyedSprite =
				plot.destroyed && archetype.destroyedSprite !== undefined
			const buildingSprite = useDestroyedSprite
				? archetype.destroyedSprite
				: requirePrimaryVisualSprite(archetype)
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
