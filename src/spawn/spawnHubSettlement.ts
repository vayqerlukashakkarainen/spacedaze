import { k, layers } from "../main"
import { getHubLevel } from "../services/hub/hubProgressService"
import {
	getHubSettlementState,
} from "../services/hub/hubSettlementService"
import { tags } from "../tags"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth"

export function spawnHubSettlement() {
	const center = k.center()
	const state = getHubSettlementState(getHubLevel())
	for (const plot of state) {
		const position = center.add(...plot.position)
		const facingScaleX = plot.facing === "left" ? -1 : 1
		k.add([
			k.pos(position.add(0, plot.groundOffsetY)),
			k.sprite(plot.groundSprite),
			k.anchor("center"),
			k.scale(facingScaleX, 1),
			k.shader("rockFoundationPalette"),
			k.opacity(1),
			k.layer(layers.buildings),
			k.z(-12),
			tags.props,
			tags.gameLoop,
		])
		const sprite = plot.built ? plot.builtSprite : plot.destroyedSprite
		if (!sprite) continue
		const building = k.add([
			k.pos(position.add(0, plot.buildingOffsetY)),
			k.sprite(sprite),
			k.anchor("center"),
			k.scale(facingScaleX, 1),
			k.color(plot.built ? 145 : 82, plot.built ? 160 : 92, plot.built ? 170 : 102),
			k.opacity(1),
			k.layer(layers.game),
			k.z(-20),
			tags.props,
			tags.gameLoop,
		])
		addBuildingPlayerDepth(building)
	}
}
