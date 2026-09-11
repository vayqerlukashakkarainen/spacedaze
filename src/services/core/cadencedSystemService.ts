import type { GameObj } from "kaplay"
import { DensePool } from "./densePool"
import { profileSection, setPerformanceCounter } from "../debug/frameProfilerService"

interface CadencedEntry {
	owner: GameObj
}

interface CadencedSystemOptions<T extends CadencedEntry> {
	id: string
	rate: number
	updateBucket: (entries: readonly T[], elapsed: number) => void
}

export interface CadencedSystem<T extends CadencedEntry> {
	add: (entry: T) => void
	remove: (ownerId: number) => boolean
	clear: () => void
}

interface InternalCadencedSystem {
	update: (delta: number) => void
	clear: () => void
}

const TARGET_FRAME_RATE = 60
const systems: InternalCadencedSystem[] = []

export function createCadencedSystem<T extends CadencedEntry>(
	options: CadencedSystemOptions<T>
): CadencedSystem<T> {
	const intervalFrames = Math.max(
		1,
		Math.round(TARGET_FRAME_RATE / Math.max(1, options.rate))
	)
	const buckets = Array.from(
		{ length: intervalFrames },
		() => new DensePool<T>((entry) => entry.owner.id)
	)
	const elapsedByBucket = new Array(intervalFrames).fill(0) as number[]
	const bucketStep = 1 / TARGET_FRAME_RATE
	let bucketAccumulator = 0
	let nextBucketIndex = 0

	const system: InternalCadencedSystem = {
		update(delta) {
			const elapsed = Math.max(0, delta)
			for (let index = 0; index < intervalFrames; index++) {
				elapsedByBucket[index] += elapsed
			}
			bucketAccumulator += elapsed
			const dueBucketTicks = Math.floor(
				(bucketAccumulator + 0.000000001) / bucketStep
			)
			if (dueBucketTicks <= 0) return
			bucketAccumulator -= dueBucketTicks * bucketStep

			const dueBuckets = Math.min(dueBucketTicks, intervalFrames)
			for (let offset = 0; offset < dueBuckets; offset++) {
				const bucketIndex = (nextBucketIndex + offset) % intervalFrames
				updateBucket(bucketIndex)
			}
			nextBucketIndex = (nextBucketIndex + dueBucketTicks) % intervalFrames
		},
		clear() {
			for (const bucket of buckets) bucket.clear()
			elapsedByBucket.fill(0)
			bucketAccumulator = 0
			nextBucketIndex = 0
		},
	}
	const updateBucket = (bucketIndex: number) => {
		const bucket = buckets[bucketIndex]
		const elapsed = elapsedByBucket[bucketIndex]
		elapsedByBucket[bucketIndex] = 0
		if (bucket.size === 0) return
		profileSection(`cadence:${options.id}`, () => {
			bucket.withItems((entries) => options.updateBucket(entries, elapsed))
		})
		setPerformanceCounter(`cadence:${options.id}:count`, bucket.size)
	}
	systems.push(system)

	return {
		add(entry) {
			const bucketIndex = Math.abs(entry.owner.id) % intervalFrames
			buckets[bucketIndex].add(entry)
			entry.owner.onDestroy(() => buckets[bucketIndex].remove(entry.owner.id))
		},
		remove(ownerId) {
			return buckets[Math.abs(ownerId) % intervalFrames].remove(ownerId)
		},
		clear: system.clear,
	}
}

export function updateCadencedSystems(delta: number) {
	for (let index = 0; index < systems.length; index++) systems[index].update(delta)
}

export function clearCadencedSystemEntries() {
	for (const system of systems) system.clear()
}
