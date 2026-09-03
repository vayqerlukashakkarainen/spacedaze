import type { Vec2 } from "kaplay"
import { showDamageNumber } from "./damageService"

export interface DestructibleWallState {
	hp: number
	maxHp: number
	destroyed: boolean
}

interface DestructibleWallRegistration extends DestructibleWallState {
	onDamaged?: (state: DestructibleWallState, impactPos?: Vec2) => void
	onDestroyed?: (state: DestructibleWallState) => void
}

const walls = new Map<string, DestructibleWallRegistration>()

export function registerDestructibleWall(options: {
	gridKey: string
	coord: { q: number; r: number }
	maxHp: number
	onDamaged?: (state: DestructibleWallState, impactPos?: Vec2) => void
	onDestroyed?: (state: DestructibleWallState) => void
}) {
	const state: DestructibleWallRegistration = {
		hp: options.maxHp,
		maxHp: options.maxHp,
		destroyed: false,
		onDamaged: options.onDamaged,
		onDestroyed: options.onDestroyed,
	}
	walls.set(wallKey(options.gridKey, options.coord), state)
	return state
}

export function damageDestructibleWall(
	gridKey: string,
	coord: { q: number; r: number },
	damage: number,
	impactPos?: Vec2
) {
	const state = walls.get(wallKey(gridKey, coord))
	if (!state || state.destroyed) return undefined

	const appliedDamage = Math.min(state.hp, Math.max(0, damage))
	state.hp = Math.max(0, state.hp - appliedDamage)
	if (impactPos) showDamageNumber(impactPos, appliedDamage)
	state.onDamaged?.(state, impactPos)
	if (state.hp > 0) return state

	state.destroyed = true
	state.onDestroyed?.(state)
	return state
}

export function clearDestructibleWalls(gridKey: string) {
	const prefix = `${gridKey}:`
	for (const key of walls.keys()) {
		if (key.startsWith(prefix)) walls.delete(key)
	}
}

function wallKey(gridKey: string, coord: { q: number; r: number }) {
	return `${gridKey}:${coord.q},${coord.r}`
}
