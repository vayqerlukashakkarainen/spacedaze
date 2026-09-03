import type { RoomRole } from "../generationTypes"

export type GeneratedFeatureSlot = "resource_node" | "hazard"
export type GeneratedContentSlot = RoomRole | GeneratedFeatureSlot

export type GeneratedContentId =
	| "combat_assassins"
	| "reward_chest"
	| "asteroid_field"
	| "capture_shrine"
	| "damage_shrine"
	| "rift_junction"
	| "repair_station"
	| "gravity_anomaly"
	| "minefield"
	| "lost_convoy"
	| "signal_relay"
	| "salvage_crate"
	| "slow_field"
	| "floor_exit"
	| "milestone_boss"

export interface GeneratedContentDefinition {
	id: GeneratedContentId
	slot: GeneratedContentSlot
	weight: number
	minDepth?: number
}

export const GENERATED_CONTENT_REGISTRY: readonly GeneratedContentDefinition[] = [
	{ id: "combat_assassins", slot: "combat", weight: 1 },
	{ id: "reward_chest", slot: "reward", weight: 1 },
	{ id: "asteroid_field", slot: "asteroid", weight: 1 },
	{ id: "capture_shrine", slot: "shrine", weight: 1 },
	{ id: "damage_shrine", slot: "shrine", weight: 1, minDepth: 2 },
	{ id: "rift_junction", slot: "rift", weight: 1 },
	{ id: "repair_station", slot: "repair", weight: 1 },
	{ id: "gravity_anomaly", slot: "anomaly", weight: 1 },
	{ id: "minefield", slot: "minefield", weight: 1 },
	{ id: "lost_convoy", slot: "convoy", weight: 1 },
	{ id: "signal_relay", slot: "relay", weight: 1 },
	{ id: "salvage_crate", slot: "resource_node", weight: 1 },
	{ id: "slow_field", slot: "hazard", weight: 1 },
	{ id: "floor_exit", slot: "exit", weight: 1 },
	{ id: "milestone_boss", slot: "boss", weight: 1, minDepth: 3 },
]

export function selectGeneratedContent(
	slot: GeneratedContentSlot,
	seed: number,
	coord: { q: number; r: number },
	depth: number
): GeneratedContentDefinition | undefined {
	const candidates = GENERATED_CONTENT_REGISTRY.filter(
		(definition) =>
			definition.slot === slot && depth >= (definition.minDepth ?? 1)
	)
	if (candidates.length === 0) return undefined

	const totalWeight = candidates.reduce(
		(total, definition) => total + definition.weight,
		0
	)
	let roll = seededUnit(seed, coord.q, coord.r, depth) * totalWeight
	for (const definition of candidates) {
		roll -= definition.weight
		if (roll <= 0) return definition
	}
	return candidates[candidates.length - 1]
}

function seededUnit(seed: number, q: number, r: number, depth: number) {
	let hash = seed ^ Math.imul(q + 1, 73856093)
	hash ^= Math.imul(r + 1, 19349663)
	hash ^= Math.imul(depth + 1, 83492791)
	hash = Math.imul(hash ^ (hash >>> 16), 2246822519)
	hash = Math.imul(hash ^ (hash >>> 13), 3266489917)
	return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000
}
