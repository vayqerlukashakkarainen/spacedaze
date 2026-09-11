import { getFloorPositionForDepth } from "../../levels/floorThemes/floorThemeDirectory"

export type WakeMiniBossId =
	| "wake-boiler-hulk"
	| "wake-magnet-maw"
	| "wake-railbreaker-rig"

const WAKE_MINI_BOSS_BY_SUBFLOOR: readonly WakeMiniBossId[] = [
	"wake-boiler-hulk",
	"wake-magnet-maw",
	"wake-railbreaker-rig",
]

export function getWakeMiniBossForDepth(depth: number): WakeMiniBossId {
	const subfloor = getFloorPositionForDepth(depth).subfloor
	return WAKE_MINI_BOSS_BY_SUBFLOOR[
		Math.max(0, subfloor - 1) % WAKE_MINI_BOSS_BY_SUBFLOOR.length
	]
}

export function getWakeMiniBossRoster() {
	return [...WAKE_MINI_BOSS_BY_SUBFLOOR]
}

export function getWakeMiniBossHealthForDepth(depth: number) {
	return (20 + Math.max(1, Math.floor(depth)) * 2) * 10
}
