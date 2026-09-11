import type { WakeEnemyId } from "./enemyProgressionService"

const WAKE_ENCOUNTERS: Readonly<Record<number, readonly (readonly WakeEnemyId[])[]>> = {
	1: [
		["wake-scrappers-hut", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-scrap-raiser", "wake-scrap-nipper", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-clampback", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-fuse-rat", "wake-rivet-gunner", "wake-scrap-nipper"],
	],
	2: [
		["wake-scrappers-hut", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-scrap-raiser", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-patch-tender", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-clampback", "wake-fuse-rat", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-shredder-skiff", "wake-rivet-gunner", "wake-scrap-nipper"],
	],
	3: [
		["wake-scrappers-hut", "wake-patch-tender", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-scrap-raiser", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-towhook-rig", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-shredder-skiff", "wake-clampback", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-fuse-rat", "wake-patch-tender", "wake-clampback", "wake-scrap-nipper"],
	],
	4: [
		["wake-scrappers-hut", "wake-scrap-raiser", "wake-patch-tender", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-towhook-rig", "wake-towhook-rig", "wake-rivet-gunner", "wake-rivet-gunner", "wake-scrap-nipper", "wake-scrap-nipper"],
		["wake-shredder-skiff", "wake-fuse-rat", "wake-clampback", "wake-rivet-gunner", "wake-scrap-nipper"],
	],
	5: [
		["wake-scrappers-hut", "wake-scrap-raiser", "wake-patch-tender", "wake-towhook-rig", "wake-rivet-gunner", "wake-scrap-nipper"],
		["wake-shredder-skiff", "wake-shredder-skiff", "wake-fuse-rat", "wake-clampback", "wake-patch-tender", "wake-rivet-gunner"],
	],
}

export function createWakeEncounterEnemies(
	tier: number,
	random: () => number,
	subfloor: number = 3
): WakeEnemyId[] {
	const normalizedTier = Math.max(1, Math.min(5, Math.round(tier)))
	const formations = WAKE_ENCOUNTERS[normalizedTier]
	const index = Math.min(
		formations.length - 1,
		Math.floor(random() * formations.length)
	)
	const enemies = [...formations[index]]
	if (subfloor > 1) return enemies
	return enemies.map((enemyId) =>
		enemyId === "wake-rivet-gunner" ||
		enemyId === "wake-fuse-rat" ||
		enemyId === "wake-shredder-skiff"
			? "wake-scrap-nipper"
			: enemyId
	)
}
