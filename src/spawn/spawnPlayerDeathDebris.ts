import type { Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"

const BASE_PLAYER_DEATH_DEBRIS_COUNT = 18
const MAX_PLAYER_DEATH_DEBRIS_COUNT = 84

export function spawnPlayerDeathDebris(pos: Vec2, carriedDebree = 0) {
	const debrisCount = Math.min(
		MAX_PLAYER_DEATH_DEBRIS_COUNT,
		BASE_PLAYER_DEATH_DEBRIS_COUNT + Math.ceil(Math.max(0, carriedDebree) * 0.7)
	)
	const burstScale = 1 + Math.min(1.6, Math.sqrt(Math.max(0, carriedDebree)) * 0.08)
	for (let index = 0; index < debrisCount; index++) {
		const direction = k.Vec2.fromAngle(k.rand(0, 360))
		const fragment = k.add([
			k.pos(pos.add(direction.scale(k.rand(1, 7)))),
			k.sprite("debree_part1"),
			k.anchor("center"),
			k.rotate(k.rand(0, 360)),
			k.scale(k.rand(0.65, 1.35)),
			k.color(k.WHITE),
			k.opacity(1),
			k.offscreen({ destroy: true }),
			{
				velocity: direction.scale(k.rand(18, 48) * burstScale),
				angularVelocity: k.rand(-150, 150),
			},
			tags.props,
			tags.gameLoop,
		])

		registerBatchedEntityUpdate("effects", fragment, () => {
			fragment.move(fragment.velocity)
			fragment.angle += fragment.angularVelocity * k.dt()
		})
	}
}
