import type { GameObj } from "kaplay"
import { playerObj } from "../game"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"

const BUILDING_DEPTH_OFFSET = 0.2
const DEPTH_SWITCH_PADDING = 3
const BEHIND_PLAYER_Z = -20
const IN_FRONT_OF_PLAYER_Z = 20

interface BuildingPlayerDepthOptions {
	centerY?: () => number
	renderedHeight?: () => number
}

export function addBuildingPlayerDepth(
	building: GameObj,
	options: BuildingPlayerDepthOptions = {}
) {
	const centerY = options.centerY ?? (() => building.pos.y)
	const renderedHeight = options.renderedHeight ?? (() => {
		const scaleY = Math.abs(building.scale?.y ?? 1)
		return building.height * scaleY
	})
	let playerBehindBuilding: boolean | undefined

	const updateDepth = () => {
		const totalHeight = renderedHeight()
		const depthThresholdY = centerY()
			+ totalHeight * (BUILDING_DEPTH_OFFSET - 0.5)
		const nextPlayerBehindBuilding = playerBehindBuilding === true
			? playerObj.pos.y < depthThresholdY + DEPTH_SWITCH_PADDING
			: playerObj.pos.y < depthThresholdY - DEPTH_SWITCH_PADDING
		if (nextPlayerBehindBuilding === playerBehindBuilding) return
		playerBehindBuilding = nextPlayerBehindBuilding
		building.z = playerBehindBuilding
			? IN_FRONT_OF_PLAYER_Z
			: BEHIND_PLAYER_Z
	}

	updateDepth()
	registerBatchedEntityUpdate("world", building, updateDepth)
}
