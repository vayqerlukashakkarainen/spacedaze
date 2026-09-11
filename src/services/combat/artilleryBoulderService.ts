import type { Vec2 } from "kaplay"
import { ASTEROID_SPRITES } from "../../asteroidSprites"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"

const BOULDER_START_SCALE = 0.55
const BOULDER_APEX_SCALE = 1.65
const BOULDER_LANDING_SCALE = 0.8
const BOULDER_ARC_OFFSET = 34

export function spawnArtilleryBoulder(
	start: Vec2,
	target: Vec2,
	duration: number,
	extraTags?: string[]
) {
	const sprite = ASTEROID_SPRITES[
		Math.floor(k.rand(0, ASTEROID_SPRITES.length))
	]
	const travel = target.sub(start)
	const arcDirection = travel.len() > 0
		? travel.unit().normal()
		: k.vec2(1, 0)
	const arcSide = k.rand(0, 1) < 0.5 ? -1 : 1
	const boulder = k.add([
		k.pos(start),
		k.sprite(sprite),
		k.anchor("center"),
		k.color(k.WHITE),
		k.rotate(k.rand(0, 360)),
		k.scale(BOULDER_START_SCALE),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			spin: k.rand(-180, 180),
		},
		tags.props,
		tags.gameLoop,
		...(extraTags ?? []),
	])

	registerBatchedEntityUpdate("effects", boulder, () => {
		boulder.elapsed += k.dt()
		const progress = k.clamp(boulder.elapsed / duration, 0, 1)
		const altitude = Math.sin(progress * Math.PI)
		boulder.pos = start.lerp(target, progress).add(
			arcDirection.scale(altitude * BOULDER_ARC_OFFSET * arcSide)
		)
		boulder.scale = k.vec2(
			progress < 0.5
				? k.lerp(BOULDER_START_SCALE, BOULDER_APEX_SCALE, progress * 2)
				: k.lerp(BOULDER_APEX_SCALE, BOULDER_LANDING_SCALE, (progress - 0.5) * 2)
		)
		boulder.angle += boulder.spin * k.dt()
		if (progress >= 1) k.destroy(boulder)
	})
}
