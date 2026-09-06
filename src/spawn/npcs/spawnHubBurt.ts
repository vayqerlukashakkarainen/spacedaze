import type { GameObj } from "kaplay"
import { horizontalDirectionalVisual } from "../../comp/horizontalDirectionalVisual"
import { k, layers } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { tags } from "../../tags"

export const BURT_TAG = "burt"

const PLAYER_ACKNOWLEDGE_DISTANCE = 110
const BURT_HOME_OFFSET_X = 42
const BURT_HOME_OFFSET_Y = 8
const HOUSE_BOB_AMOUNT = 3
const HOUSE_BOB_SPEED = 1.25

export function spawnHubBurt(homePosition: ReturnType<typeof k.vec2>) {
	const house = k.add([
		k.pos(homePosition),
		k.sprite("companion_burt_house"),
		k.anchor("center"),
		k.color(k.WHITE),
		k.layer(layers.buildings),
		k.z(8),
		tags.props,
		tags.gameLoop,
	])
	const burt = k.add([
		k.pos(homePosition.add(BURT_HOME_OFFSET_X, BURT_HOME_OFFSET_Y)),
		k.sprite("companion_burt"),
		k.anchor("center"),
		k.rotate(0),
		horizontalDirectionalVisual({
			nativeFacing: "left",
			initialFacing: "left",
			maxLean: 8,
		}),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(20),
		BURT_TAG,
		tags.props,
		tags.gameLoop,
	])
	const houseBaseY = homePosition.y

	registerBatchedEntityUpdate("world", house, () => {
		house.pos.y = houseBaseY + Math.sin(k.time() * HOUSE_BOB_SPEED) *
			HOUSE_BOB_AMOUNT
	})

	registerBatchedEntityUpdate("world", burt, () => {
		const player = k.get<GameObj>(tags.player)[0]
		if (!player?.exists()) return
		const toPlayer = player.pos.sub(burt.pos)
		if (toPlayer.len() > PLAYER_ACKNOWLEDGE_DISTANCE) return
		burt.faceHorizontal(toPlayer.x)
	})

	return { house, burt }
}
