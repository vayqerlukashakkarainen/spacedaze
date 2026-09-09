import type { WakeEnemyId } from "./enemyProgressionService"

const WAKE_ENCOUNTERS: Readonly<Record<number, readonly (readonly WakeEnemyId[])[]>> = {
	1: [
		["wake-scrap-nipper", "wake-scrap-nipper", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
	],
	2: [
		["wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-patch-tender", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper"],
	],
	3: [
		["wake-patch-tender", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-towhook-rig", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
	],
	4: [
		["wake-patch-tender", "wake-towhook-rig", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-towhook-rig", "wake-towhook-rig", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
	],
	5: [
		["wake-patch-tender", "wake-towhook-rig", "wake-towhook-rig", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
	],
}

export function createWakeEncounterEnemies(
	tier: number,
	random: () => number
): WakeEnemyId[] {
	const normalizedTier = Math.max(1, Math.min(5, Math.round(tier)))
	const formations = WAKE_ENCOUNTERS[normalizedTier]
	const index = Math.min(
		formations.length - 1,
		Math.floor(random() * formations.length)
	)
	return [...formations[index]]
}
