import type { Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"

const BASE_PLAYER_DEATH_DEBRIS_COUNT = 18
const MAX_PLAYER_DEATH_DEBRIS_COUNT = 84
const PROLOGUE_SHIP_PART_COUNT = 5
const PROLOGUE_PART_SPRITES = [
	"enemy_fighter_left_wing",
	"enemy_fighter_right_wing",
	"enemy_fighter_core",
	"particle3",
	"particle4",
] as const

export function spawnPlayerDeathDebris(
	pos: Vec2,
	carriedDebree = 0,
	prologue = false
) {
	if (prologue) {
		spawnPrologueShipParts(pos)
		return
	}
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

function spawnPrologueShipParts(pos: Vec2) {
	for (let index = 0; index < PROLOGUE_SHIP_PART_COUNT; index++) {
		const direction = k.Vec2.fromAngle(index / PROLOGUE_SHIP_PART_COUNT * 360)
		const destination = pos.add(direction.scale(34 + index % 2 * 9))
		const part = k.add([
			k.pos(pos.add(direction.scale(4))),
			k.sprite(PROLOGUE_PART_SPRITES[index]),
			k.anchor("center"),
			k.rotate(k.rand(0, 360)),
			k.scale(index < 3 ? 0.72 : 0.85),
			k.color(k.WHITE),
			{
				velocity: direction.scale(76 + index * 7),
				destination,
				angularVelocity: index % 2 === 0 ? 115 : -125,
			},
			tags.props,
			tags.prologueShipPart,
		])

		part.onUpdate(() => {
			part.velocity = part.velocity.scale(Math.pow(0.9, k.dt() * 60))
			part.pos = part.pos.add(part.velocity.scale(k.dt()))
			part.pos = part.pos.lerp(part.destination, Math.min(1, k.dt() * 1.8))
			part.angle += part.angularVelocity * k.dt()
			part.angularVelocity *= Math.pow(0.97, k.dt() * 60)
		})
	}
}
