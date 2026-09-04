export type PlayerStatusStat =
	| "movement"
	| "weaponRecovery"
	| "incomingDamage"
	| "outgoingDamage"

export interface PlayerStatusEffect {
	id: string
	sourceId: number
	stat: PlayerStatusStat
	multiplier: number
	duration: number
	remaining: number
}

const effects = new Map<string, PlayerStatusEffect>()

export function applyPlayerStatusEffect(options: {
	id: string
	sourceId: number
	stat: PlayerStatusStat
	multiplier: number
	duration: number
}) {
	const key = effectKey(options.sourceId, options.id)
	effects.set(key, {
		...options,
		multiplier: Math.max(0.2, Math.min(3, options.multiplier)),
		remaining: options.duration,
	})
}

export function updatePlayerStatusEffects(delta: number) {
	if (delta <= 0) return
	for (const [key, effect] of effects) {
		if (!Number.isFinite(effect.remaining)) continue
		effect.remaining -= delta
		if (effect.remaining <= 0) effects.delete(key)
	}
}

export function getPlayerStatusMultiplier(stat: PlayerStatusStat) {
	let multiplier = 1
	for (const effect of effects.values()) {
		if (effect.stat === stat) multiplier *= effect.multiplier
	}
	return Math.max(0.2, Math.min(3, multiplier))
}

export function clearPlayerStatusEffectsFromSource(sourceId: number) {
	for (const [key, effect] of effects) {
		if (effect.sourceId === sourceId) effects.delete(key)
	}
}

export function clearPlayerStatusEffect(sourceId: number, id: string) {
	effects.delete(effectKey(sourceId, id))
}

export function clearPlayerStatusEffects() {
	effects.clear()
}

export function getPlayerStatusEffectSnapshot() {
	return [...effects.values()].map((effect) => ({ ...effect }))
}

function effectKey(sourceId: number, id: string) {
	return `${sourceId}:${id}`
}
