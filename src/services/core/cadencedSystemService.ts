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
	update: (delta: number, frame: number) => void
	clear: () => void
}

const TARGET_FRAME_RATE = 60
const systems: InternalCadencedSystem[] = []
let cadenceFrame = 0

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

	const system: InternalCadencedSystem = {
		update(delta, frame) {
			for (let index = 0; index < intervalFrames; index++) {
				elapsedByBucket[index] += delta
			}
			const bucketIndex = frame % intervalFrames
			const bucket = buckets[bucketIndex]
			if (bucket.size === 0) {
				elapsedByBucket[bucketIndex] = 0
				return
			}
			const elapsed = elapsedByBucket[bucketIndex]
			elapsedByBucket[bucketIndex] = 0
			profileSection(`cadence:${options.id}`, () => {
				bucket.withItems((entries) => options.updateBucket(entries, elapsed))
			})
			setPerformanceCounter(`cadence:${options.id}:count`, bucket.size)
		},
		clear() {
			for (const bucket of buckets) bucket.clear()
			elapsedByBucket.fill(0)
		},
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
	cadenceFrame++
	for (let index = 0; index < systems.length; index++) {
		systems[index].update(delta, cadenceFrame)
	}
}

export function clearCadencedSystemEntries() {
	for (const system of systems) system.clear()
	cadenceFrame = 0
}
