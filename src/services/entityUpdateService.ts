import type { GameObj } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { DensePool } from "./densePool"
import { profileSection, setPerformanceCounter } from "./frameProfilerService"
import { runLoop } from "./runLoopService"

export const ENTITY_UPDATE_GROUPS = [
	"enemies",
	"followers",
	"debris",
	"world",
	"effects",
] as const

export type EntityUpdateGroup = typeof ENTITY_UPDATE_GROUPS[number]

interface EntityUpdateEntry {
	id: number
	obj: GameObj
	update: () => void
}

const pools = new Map<EntityUpdateGroup, DensePool<EntityUpdateEntry>>()
let legacyController: GameObj | undefined
let nextEntryId = 1

for (const group of ENTITY_UPDATE_GROUPS) {
	pools.set(group, new DensePool<EntityUpdateEntry>((entry) => entry.id))
}

export function registerBatchedEntityUpdate(
	group: EntityUpdateGroup,
	obj: GameObj,
	update: () => void
) {
	const pool = pools.get(group)
	if (!pool) throw new Error(`Unknown entity update group: ${group}`)
	const entryId = nextEntryId++
	pool.add({ id: entryId, obj, update })
	obj.onDestroy(() => pool.remove(entryId))
	ensureLegacyController()
}

export function updateBatchedEntities() {
	for (const group of ENTITY_UPDATE_GROUPS) {
		const pool = pools.get(group)
		if (!pool || pool.size === 0) continue
		profileSection(`batch:${group}`, () => {
			pool.forEach((entry) => {
				if (!entry.obj.exists()) {
					pool.remove(entry.id)
					return
				}
				if (entry.obj.paused) return
				entry.update()
			})
		})
		setPerformanceCounter(`batch:${group}:count`, pool.size)
	}
}

export function getBatchedEntityCounts() {
	return Object.fromEntries(
		ENTITY_UPDATE_GROUPS.map((group) => [group, pools.get(group)?.size ?? 0])
	) as Record<EntityUpdateGroup, number>
}

export function clearBatchedEntityUpdates() {
	for (const pool of pools.values()) pool.clear()
}

function ensureLegacyController() {
	if (legacyController?.exists()) return
	const controller = k.add([tags.props, tags.gameLoop])
	legacyController = controller
	controller.onUpdate(() => {
		if (!runLoop.isEnabled()) updateBatchedEntities()
	})
	controller.onDestroy(() => {
		if (legacyController?.id !== controller.id) return
		legacyController = undefined
	})
}
