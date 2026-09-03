import type { GameObj, Vec2 } from "kaplay"
import { spawnDamageNumber } from "../spawn/spawnDamageNumber"
import { tags } from "../tags"
import { isPlayerDamageInvulnerable } from "./playerDamageState"
import { tryBlockPlayerDamage } from "./shipUpgradeService"

export interface DamageOptions {
	critical?: boolean
	position?: Vec2
	showNumber?: boolean
	source?: PlayerDeathCause
}

export interface PlayerDeathCause {
	name: string
	sprite?: string
}

const UNKNOWN_DEATH_CAUSE: PlayerDeathCause = {
	name: "UNKNOWN HAZARD",
	sprite: "bullet1",
}
let playerDeathCause: PlayerDeathCause = { ...UNKNOWN_DEATH_CAUSE }

export function getPlayerDeathCause(): PlayerDeathCause {
	return { ...playerDeathCause }
}

export function resetPlayerDeathCause() {
	playerDeathCause = { ...UNKNOWN_DEATH_CAUSE }
}

export function applyDamage(
	target: GameObj,
	damage: number,
	options: DamageOptions = {}
) {
	if (!target.exists() || typeof target.hurt !== "function") return false
	if (!Number.isFinite(damage) || damage <= 0) return false
	if (
		target.tags.includes(tags.player) &&
		isPlayerDamageInvulnerable()
	) return false
	if (tryBlockPlayerDamage(target, damage)) return false

	const numberPos = options.position?.clone() ?? target.pos?.clone()
	if (target.tags.includes(tags.player) && options.source) {
		playerDeathCause = { ...options.source }
	}
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
