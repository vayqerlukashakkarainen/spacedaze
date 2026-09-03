import type { GameObj, Vec2 } from "kaplay"
import { spawnDamageNumber } from "../spawn/spawnDamageNumber"

export interface DamageOptions {
	critical?: boolean
	position?: Vec2
	showNumber?: boolean
}

export function applyDamage(
	target: GameObj,
	damage: number,
	options: DamageOptions = {}
) {
	if (!target.exists() || typeof target.hurt !== "function") return false
	if (!Number.isFinite(damage) || damage <= 0) return false

	const numberPos = options.position?.clone() ?? target.pos?.clone()
	target.hurt(damage)
	if (options.showNumber !== false && numberPos) {
		spawnDamageNumber(numberPos, damage, {
			critical: options.critical,
		})
	}
	return true
}

export function showDamageNumber(
	position: Vec2,
	damage: number,
	options: Pick<DamageOptions, "critical"> = {}
) {
	spawnDamageNumber(position, damage, options)
}
