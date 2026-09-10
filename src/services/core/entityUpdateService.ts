import type { GameObj } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"
import {
	clearCadencedSystemEntries,
	updateCadencedSystems,
} from "./cadencedSystemService"
import {
	clearContinuousSystemEntries,
	updateContinuousSystems,
} from "./continuousSystemService"
import { DensePool } from "./densePool"
import {
	registerEnemyVisual,
	registerRuntimeSpriteVisual,
} from "../enemies/enemyVisualBatchService"
import { profileSection, setPerformanceCounter } from "../debug/frameProfilerService"
import { runLoop } from "../runs/runLoopService"

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
let entityUpdateFrame = 0

const OFFSCREEN_ENEMY_UPDATE_INTERVAL = 6
const OFFSCREEN_DEBRIS_UPDATE_INTERVAL = 6
const DENSE_ENEMY_THRESHOLD = 250
const DENSE_ENEMY_UPDATE_INTERVAL = 2
const DENSE_OFFSCREEN_ENEMY_UPDATE_INTERVAL = 10

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
	let registered = true
	const unregister = () => {
		if (!registered) return
		registered = false
		pool.remove(entryId)
	}
	pool.add({ id: entryId, obj, update })
	if (group === "enemies") registerEnemyVisual(obj)
	if (group === "debris") registerRuntimeSpriteVisual(obj)
	if (group === "effects" && obj.pos && !obj.is(tags.runtimeCullable)) {
		obj.tag(tags.runtimeCullable)
	}
	obj.onDestroy(unregister)
	ensureLegacyController()
	return unregister
}

export function updateBatchedEntities() {
	entityUpdateFrame++
	profileSection("batch:cadenced", () => updateCadencedSystems(k.dt()))
	profileSection("batch:continuous", updateContinuousSystems)
	for (const group of ENTITY_UPDATE_GROUPS) {
		const pool = pools.get(group)
		if (!pool || pool.size === 0) continue
		profileSection(`batch:${group}`, () => {
			let skipped = 0
			pool.forEach((entry) => {
				if (!entry.obj.exists()) {
					pool.remove(entry.id)
					return
				}
				if (entry.obj.paused) return
				const updateInterval = getUpdateInterval(group, entry.obj)
				if (
					updateInterval > 1 &&
					(entityUpdateFrame + entry.obj.id) % updateInterval !== 0
				) {
					skipped++
					return
				}
				entry.obj.runtimeUpdateScale = updateInterval
				try {
					entry.update()
				} finally {
					entry.obj.runtimeUpdateScale = 1
				}
			})
			setPerformanceCounter(`batch:${group}:skipped`, skipped)
		})
		setPerformanceCounter(`batch:${group}:count`, pool.size)
	}
}

function getUpdateInterval(group: EntityUpdateGroup, obj: GameObj) {
	const denseEnemies = group === "enemies" &&
		(pools.get("enemies")?.size ?? 0) >= DENSE_ENEMY_THRESHOLD
	if (
		group === "enemies" &&
		obj.runtimeVisibilityCulled === true &&
		obj.has("timescale")
	) return denseEnemies
		? DENSE_OFFSCREEN_ENEMY_UPDATE_INTERVAL
		: OFFSCREEN_ENEMY_UPDATE_INTERVAL
	if (denseEnemies && obj.has("timescale")) {
		return DENSE_ENEMY_UPDATE_INTERVAL
	}
	if (
		group === "debris" &&
		obj.runtimeVisibilityCulled === true &&
		obj.has("timescale")
	) return OFFSCREEN_DEBRIS_UPDATE_INTERVAL
	return 1
}

export function getBatchedEntityCounts() {
	return Object.fromEntries(
		ENTITY_UPDATE_GROUPS.map((group) => [group, pools.get(group)?.size ?? 0])
	) as Record<EntityUpdateGroup, number>
}

export function clearBatchedEntityUpdates() {
	for (const pool of pools.values()) pool.clear()
	clearCadencedSystemEntries()
	clearContinuousSystemEntries()
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
