import type { Color, Vec2 } from "kaplay"
import { timescale } from "../comp/timescale"
import { k, layers } from "../main"
import { tags } from "../tags"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
const DAMAGE_NUMBER_LIFETIME = 0.65
const DAMAGE_NUMBER_RISE_SPEED = 24
const DAMAGE_NUMBER_SIZE = 7
const CRITICAL_DAMAGE_NUMBER_SIZE = 8

interface DamageNumberOptions {
	critical?: boolean
	color?: Color
	prefix?: string
}

const PLAYER_DAMAGE_COLOR = [255, 70, 70] as const
const PLAYER_HEALING_COLOR = [70, 255, 120] as const

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
			size: critical ? CRITICAL_DAMAGE_NUMBER_SIZE : DAMAGE_NUMBER_SIZE,
			font: "unscii",
		}),
		k.anchor("center"),
		k.color(options.color ?? (critical ? k.RED : k.WHITE)),
		k.opacity(1),
		k.scale(critical ? 1.1 : 1),
		k.z(100),
		k.layer(layers.gameText),
		timescale(),
		{
			elapsed: 0,
		},
		tags.damageNumber,
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", number, () => {
		const delta = k.dt() * number.getTimescale()
		number.elapsed += delta
		number.move(0, -DAMAGE_NUMBER_RISE_SPEED * number.getTimescale())
		number.opacity = 1 - k.clamp(number.elapsed / DAMAGE_NUMBER_LIFETIME, 0, 1)
		if (number.elapsed >= DAMAGE_NUMBER_LIFETIME) k.destroy(number)
	})
}

export function spawnPlayerDamageNumber(
	pos: Vec2,
	damage: number,
	options: Pick<DamageNumberOptions, "critical"> = {}
) {
	spawnDamageNumber(pos, damage, {
		critical: options.critical,
		color: k.rgb(...PLAYER_DAMAGE_COLOR),
	})
}

export function spawnHealingNumber(pos: Vec2, recovered: number) {
	spawnDamageNumber(pos, recovered, {
		color: k.rgb(...PLAYER_HEALING_COLOR),
		prefix: "+",
	})
}
