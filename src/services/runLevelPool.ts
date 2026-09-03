import type { LevelKey } from "../levels/levels"

export type RunLevelKey = Exclude<LevelKey, "hub">

export interface RunLevelPoolDefinition {
	id: string
	levelKeys: RunLevelKey[]
	allowReuseWhenExhausted: boolean
}

export const RUN_LEVEL_POOLS: readonly RunLevelPoolDefinition[] = [
	{
		id: "zone1",
		levelKeys: ["level2"],
		allowReuseWhenExhausted: true,
	},
]

export function getRunLevelPool(id: string) {
	return RUN_LEVEL_POOLS.find((pool) => pool.id === id)
}

export function selectNextRunLevel(
	pool: RunLevelPoolDefinition,
	visited: ReadonlySet<RunLevelKey>,
	selectionSeed: number
) {
	let candidates = pool.levelKeys.filter((levelKey) => !visited.has(levelKey))
	if (candidates.length === 0) {
		if (!pool.allowReuseWhenExhausted) return undefined
		candidates = [...pool.levelKeys]
	}
	if (candidates.length === 0) return undefined
	return candidates[selectionSeed % candidates.length]
}

export function deriveRunFloorSeed(
	baseSeed: number,
	depth: number,
	levelKey: RunLevelKey
) {
	return mixSeed(baseSeed, depth, hashString(levelKey))
}

export function deriveLevelSelectionSeed(baseSeed: number, depth: number) {
	return mixSeed(baseSeed, depth, 17)
}

function mixSeed(baseSeed: number, depth: number, salt: number) {
	let value = (baseSeed ^ Math.imul(depth, 0x45d9f3b) ^ salt) >>> 0
	value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
	value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
	return ((value ^ (value >>> 16)) >>> 0) || 1
}

function hashString(value: string) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}
