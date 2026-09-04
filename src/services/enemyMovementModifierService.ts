import {
	applyPlayerStatusEffect,
	clearPlayerStatusEffect,
	clearPlayerStatusEffects,
	getPlayerStatusMultiplier,
} from "./playerStatusEffectService"

export function setEnemyMovementMultiplier(sourceId: number, multiplier: number) {
	applyPlayerStatusEffect({
		id: "enemy-movement",
		sourceId,
		stat: "movement",
		multiplier,
		duration: Number.POSITIVE_INFINITY,
	})
}

export function clearEnemyMovementMultiplier(sourceId: number) {
	clearPlayerStatusEffect(sourceId, "enemy-movement")
}

export function getEnemyMovementMultiplier() {
	return getPlayerStatusMultiplier("movement")
}

export function clearEnemyMovementMultipliers() {
	clearPlayerStatusEffects()
}
