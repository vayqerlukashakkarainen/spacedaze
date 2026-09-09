import type { GameObj, Vec2 } from "kaplay"
import {
	spawnDamageNumber,
	spawnPlayerDamageNumber,
} from "../spawn/spawnDamageNumber"
import { tags } from "../tags"
import { isPlayerDamageInvulnerable } from "./playerDamageState"
import { tryBlockPlayerDamage } from "./shipUpgradeService"
import { getPlayerStatusMultiplier } from "./playerStatusEffectService"
import {
	recordTelemetryEnemyDamage,
	recordTelemetryPlayerDamage,
} from "./runTelemetryService"
import { runtimeDebug } from "./runtimeDebugService"
import { showPlayerDamageDirection } from "./combatImpactService"
import { LEGACY_PLAYER_DAMAGE_SCALE } from "./playerHealthBalance"
import { playDamageHitSound } from "./hitSoundService"

export interface DamageOptions {
	critical?: boolean
	position?: Vec2
	showNumber?: boolean
	source?: PlayerDeathCause
	incomingDirection?: Vec2
	playerHullDamage?: boolean
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
	if (!target.exists() || typeof target.hp !== "number") return false
	if (!Number.isFinite(damage) || damage <= 0) return false
	const shieldProvider = target.shieldProvider as GameObj | undefined
	if (
		shieldProvider?.exists() &&
		typeof shieldProvider.hp === "number" &&
		shieldProvider.hp > 0
	) {
		return applyDamage(shieldProvider, damage, {
			...options,
			position: shieldProvider.pos?.clone() ?? options.position,
		})
	}
	if (
		target.tags.includes(tags.player) &&
		(isPlayerDamageInvulnerable() || target.activeModuleInvulnerable === true)
	) return false
	const damagesPlayer = target.tags.includes(tags.player)
	const numberPos = damagesPlayer
		? target.pos?.clone()
		: options.position?.clone() ?? target.pos?.clone()
	if (damagesPlayer && options.source) {
		playerDeathCause = { ...options.source }
	}
	const playerDamage = damagesPlayer && options.playerHullDamage !== true
		? damage * LEGACY_PLAYER_DAMAGE_SCALE
		: damage
	const appliedDamage = damagesPlayer
		? playerDamage * getPlayerStatusMultiplier("incomingDamage")
		: damage
	if (tryBlockPlayerDamage(target, appliedDamage)) return false
	const healthBefore = target.hp
	if (!damagesPlayer) playDamageHitSound(target, options.position)
	target.hp -= appliedDamage
	if (damagesPlayer) {
		showPlayerDamageDirection(
			target,
			appliedDamage,
			options.position,
			options.incomingDirection
		)
		runtimeDebug.log("combat", "player:damaged", {
			amount: appliedDamage,
			healthBefore,
			healthAfter: target.hp,
			source: options.source?.name ?? "UNKNOWN HAZARD",
			fatal: target.hp <= 0,
		})
		recordTelemetryPlayerDamage(
			appliedDamage,
			options.source?.name ?? "UNKNOWN HAZARD"
		)
	}
	if (target.tags.includes(tags.enemy)) {
		const enemyType = typeof target.enemyType === "string"
			? target.enemyType
			: typeof target.sprite === "string"
				? target.sprite
				: "enemy"
		recordTelemetryEnemyDamage(enemyType, appliedDamage)
	}
	if (options.showNumber !== false && numberPos) {
		if (damagesPlayer) {
			spawnPlayerDamageNumber(numberPos, appliedDamage, {
				critical: options.critical,
			})
		} else {
			spawnDamageNumber(numberPos, appliedDamage, {
				critical: options.critical,
			})
		}
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
