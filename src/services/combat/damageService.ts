import type { GameObj, Vec2 } from "kaplay"
import {
	spawnDamageNumber,
	spawnPlayerDamageNumber,
} from "../../spawn/spawnDamageNumber"
import { tags } from "../../tags"
import { isPlayerDamageInvulnerable } from "../player/playerDamageState"
import { tryBlockPlayerDamage } from "../progression/shipUpgradeService"
import { getPlayerStatusMultiplier } from "../player/playerStatusEffectService"
import {
	recordTelemetryEnemyDamage,
	recordTelemetryPlayerDamage,
} from "../runs/runTelemetryService"
import { runtimeDebug } from "../debug/runtimeDebugService"
import { showPlayerDamageDirection } from "./combatImpactService"
import { LEGACY_PLAYER_DAMAGE_SCALE } from "../player/playerHealthBalance"
import { playDamageHitSound } from "../audio/hitSoundService"
import { playVisualHitKnockback } from "./visualHitKnockbackService"
import { ensureEnemyLowHealthEffects } from "./enemyDamageEffectService"
import type { CombatCredit } from "../progression/combatCredit"

export interface DamageOptions {
	critical?: boolean
	position?: Vec2
	showNumber?: boolean
	source?: PlayerDeathCause
	incomingDirection?: Vec2
	visualForceOrigin?: Vec2
	playerHullDamage?: boolean
	combatCredit?: CombatCredit
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
	if (!damagesPlayer && options.combatCredit) {
		target.lastCombatCredit = {
			...options.combatCredit,
			critical: options.critical || options.combatCredit.critical,
		}
	}
	if (!damagesPlayer) playDamageHitSound(target, options.position)
	if (!damagesPlayer) {
		const visualDirection = getVisualHitDirection(target, options)
		if (visualDirection) playVisualHitKnockback(target, visualDirection)
	}
	target.hp -= appliedDamage
	if (target.tags.includes(tags.enemy)) ensureEnemyLowHealthEffects(target)
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

export function getLastCombatCredit(target: GameObj): CombatCredit | undefined {
	const credit = target.lastCombatCredit as CombatCredit | undefined
	return credit ? { ...credit } : undefined
}

function getVisualHitDirection(target: GameObj, options: DamageOptions) {
	if (options.incomingDirection?.len() > 0.001) {
		return options.incomingDirection
	}
	const origin = options.visualForceOrigin ?? options.position
	const targetPosition = target.worldPos ?? target.pos
	if (!origin || !targetPosition) return undefined
	const direction = targetPosition.sub(origin)
	return direction.len() > 0.001 ? direction : undefined
}

export function showDamageNumber(
	position: Vec2,
	damage: number,
	options: Pick<DamageOptions, "critical"> = {}
) {
	spawnDamageNumber(position, damage, options)
}
