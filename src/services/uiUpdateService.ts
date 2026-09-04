import type { GameObj } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { DensePool } from "./densePool"
import { profileSection, setPerformanceCounter } from "./frameProfilerService"
import { runLoop } from "./runLoopService"

export const UI_UPDATE_GROUPS = [
	"hud",
	"overlay",
	"modal",
	"menu",
] as const

export type UiUpdateGroup = typeof UI_UPDATE_GROUPS[number]

interface UiUpdateEntry {
	id: number
	obj: GameObj
	update: () => void
}

const pools = new Map<UiUpdateGroup, DensePool<UiUpdateEntry>>()
let legacyController: GameObj | undefined
let nextEntryId = 1

for (const group of UI_UPDATE_GROUPS) {
	pools.set(group, new DensePool<UiUpdateEntry>((entry) => entry.id))
}

export function registerBatchedUiUpdate(
	group: UiUpdateGroup,
	obj: GameObj,
	update: () => void
) {
	const pool = pools.get(group)
	if (!pool) throw new Error(`Unknown UI update group: ${group}`)
	const entryId = nextEntryId++
	pool.add({ id: entryId, obj, update })
	obj.onDestroy(() => pool.remove(entryId))
	ensureLegacyController()
	return () => pool.remove(entryId)
}

export function updateBatchedUi() {
	let total = 0
	for (const group of UI_UPDATE_GROUPS) {
		const pool = pools.get(group)
		if (!pool || pool.size === 0) {
			setPerformanceCounter(`batch:ui:${group}:count`, 0)
			continue
		}
		profileSection(`batch:ui:${group}`, () => {
			pool.forEach((entry) => {
				if (!entry.obj.exists()) {
					pool.remove(entry.id)
					return
				}
				if (entry.obj.paused) return
				entry.update()
			})
		})
		total += pool.size
		setPerformanceCounter(`batch:ui:${group}:count`, pool.size)
	}
	setPerformanceCounter("batch:ui:count", total)
}

export function getBatchedUiCounts() {
	return Object.fromEntries(
		UI_UPDATE_GROUPS.map((group) => [group, pools.get(group)?.size ?? 0])
	) as Record<UiUpdateGroup, number>
}

export function clearBatchedUiUpdates() {
	for (const pool of pools.values()) pool.clear()
}

function ensureLegacyController() {
	if (legacyController?.exists()) return
	const controller = k.add([tags.props, tags.gameLoop])
	legacyController = controller
	controller.onUpdate(() => {
		if (!runLoop.isEnabled()) updateBatchedUi()
	})
	controller.onDestroy(() => {
		if (legacyController?.id !== controller.id) return
		legacyController = undefined
	})
}
