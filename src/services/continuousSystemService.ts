import type { GameObj } from "kaplay"
import { DensePool } from "./densePool"
import { profileSection, setPerformanceCounter } from "./frameProfilerService"

interface ContinuousEntry {
	owner: GameObj
}

interface ContinuousSystemOptions<T extends ContinuousEntry> {
	id: string
	updateBatch: (entries: readonly T[]) => void
}

export interface ContinuousSystem<T extends ContinuousEntry> {
	add: (entry: T) => void
	remove: (ownerId: number) => boolean
	clear: () => void
}

interface InternalContinuousSystem {
	update: () => void
	clear: () => void
}

const systems: InternalContinuousSystem[] = []

export function createContinuousSystem<T extends ContinuousEntry>(
	options: ContinuousSystemOptions<T>
): ContinuousSystem<T> {
	const pool = new DensePool<T>((entry) => entry.owner.id)
	const runBatch = (entries: readonly T[]) => options.updateBatch(entries)
	const updatePool = () => pool.withItems(runBatch)
	const profileId = `continuous:${options.id}`
	const system: InternalContinuousSystem = {
		update() {
			if (pool.size === 0) return
			profileSection(profileId, updatePool)
			setPerformanceCounter(`continuous:${options.id}:count`, pool.size)
		},
		clear() {
			pool.clear()
		},
	}
	systems.push(system)

	return {
		add(entry) {
			pool.add(entry)
			entry.owner.onDestroy(() => pool.remove(entry.owner.id))
		},
		remove(ownerId) {
			return pool.remove(ownerId)
		},
		clear: system.clear,
	}
}

export function updateContinuousSystems() {
	for (let index = 0; index < systems.length; index++) systems[index].update()
}

export function clearContinuousSystemEntries() {
	for (const system of systems) system.clear()
}
