import type { Color, Vec2 } from "kaplay"
import { timescale } from "../comp/timescale"
import { k, layers } from "../main"
import { tags } from "../tags"

const DAMAGE_NUMBER_LIFETIME = 0.65
const DAMAGE_NUMBER_RISE_SPEED = 24

interface DamageNumberOptions {
	critical?: boolean
	color?: Color
	prefix?: string
}

export function spawnDamageNumber(
	pos: Vec2,
	damage: number,
	options: DamageNumberOptions = {}
) {
	if (!Number.isFinite(damage) || damage <= 0) return

	const roundedDamage = Math.round(damage * 10) / 10
	const critical = options.critical === true
	const number = k.add([
		k.pos(pos.add(k.rand(-7, 7), k.rand(-7, -3))),
		k.text(`${options.prefix ?? ""}${roundedDamage}${critical ? "!" : ""}`, {
			size: critical ? 9 : 7,
			font: "unscii",
		}),
		k.anchor("center"),
		k.color(options.color ?? (critical ? k.RED : k.WHITE)),
		k.opacity(1),
		k.scale(critical ? 1.15 : 1),
		k.z(100),
		k.layer(layers.game),
		timescale(),
		{
			elapsed: 0,
		},
		tags.damageNumber,
		tags.gameLoop,
	])

	number.onUpdate(() => {
		const delta = k.dt() * number.getTimescale()
		number.elapsed += delta
		number.move(0, -DAMAGE_NUMBER_RISE_SPEED * number.getTimescale())
		number.opacity = 1 - k.clamp(number.elapsed / DAMAGE_NUMBER_LIFETIME, 0, 1)
		if (number.elapsed >= DAMAGE_NUMBER_LIFETIME) k.destroy(number)
	})
}
