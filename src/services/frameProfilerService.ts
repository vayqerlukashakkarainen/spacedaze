const SAMPLE_LIMIT = 900

const frameSamples: number[] = []
const sectionSamples = new Map<string, number[]>()
const currentSectionTotals = new Map<string, number>()
const currentFrameCounters = new Map<string, number>()
let previousFrameCounters: Record<string, number> = {}
let profilerEnabled = false

export interface ProfileStats {
	average: number
	p95: number
	max: number
	sampleCount: number
}

export interface FrameProfilerSnapshot {
	frameAverage: number
	frameP95: number
	frameMax: number
	frameSampleCount: number
	sections: Record<string, number>
	sectionStats: Record<string, ProfileStats>
	counters: Record<string, number>
}

export function beginProfilerFrame(milliseconds: number) {
	if (!profilerEnabled) return
	flushSectionTotals()
	previousFrameCounters = Object.fromEntries(currentFrameCounters)
	currentFrameCounters.clear()
	recordFrameTime(milliseconds)
}

export function recordFrameTime(milliseconds: number) {
	if (!profilerEnabled) return
	pushSample(frameSamples, milliseconds)
}

export function profileSection<T>(name: string, work: () => T): T {
	if (!profilerEnabled) return work()
	const startedAt = performance.now()
	const result = work()
	recordSectionTime(name, performance.now() - startedAt)
	return result
}

export function recordSectionTime(name: string, milliseconds: number) {
	if (!profilerEnabled) return
	if (!Number.isFinite(milliseconds) || milliseconds < 0) return
	currentSectionTotals.set(
		name,
		(currentSectionTotals.get(name) ?? 0) + milliseconds
	)
}

export function incrementPerformanceCounter(name: string, amount = 1) {
	if (!profilerEnabled) return
	if (!Number.isFinite(amount)) return
	currentFrameCounters.set(name, (currentFrameCounters.get(name) ?? 0) + amount)
}

export function setPerformanceCounter(name: string, value: number) {
	if (!profilerEnabled) return
	if (!Number.isFinite(value)) return
	currentFrameCounters.set(name, value)
}

export function getFrameProfilerSnapshot(): FrameProfilerSnapshot {
	const sectionStats = Object.fromEntries(
		[...sectionSamples.entries()].map(([name, samples]) => [
			name,
			summarizeSamples(samples),
		])
	)
	return {
		frameAverage: average(frameSamples),
		frameP95: percentile(frameSamples, 0.95),
		frameMax: maximum(frameSamples),
		frameSampleCount: frameSamples.length,
		sections: Object.fromEntries(
			Object.entries(sectionStats).map(([name, stats]) => [
				name,
				stats.average,
			])
		),
		sectionStats,
		counters: { ...previousFrameCounters },
	}
}

export function resetFrameProfiler() {
	frameSamples.length = 0
	sectionSamples.clear()
	currentSectionTotals.clear()
	currentFrameCounters.clear()
	previousFrameCounters = {}
}

export function setFrameProfilerEnabled(enabled: boolean) {
	if (profilerEnabled === enabled) return profilerEnabled
	profilerEnabled = enabled
	resetFrameProfiler()
	return profilerEnabled
}

export function frameProfilerEnabled() {
	return profilerEnabled
}

export function summarizeSamples(samples: number[]): ProfileStats {
	return {
		average: average(samples),
		p95: percentile(samples, 0.95),
		max: maximum(samples),
		sampleCount: samples.length,
	}
}

function flushSectionTotals() {
	for (const [name, milliseconds] of currentSectionTotals) {
		const samples = sectionSamples.get(name) ?? []
		pushSample(samples, milliseconds)
		sectionSamples.set(name, samples)
	}
	currentSectionTotals.clear()
}

function pushSample(samples: number[], value: number) {
	if (!Number.isFinite(value) || value < 0) return
	samples.push(value)
	if (samples.length > SAMPLE_LIMIT) samples.shift()
}

function average(samples: number[]) {
	if (samples.length === 0) return 0
	return samples.reduce((total, sample) => total + sample, 0) / samples.length
}

function percentile(samples: number[], percentileValue: number) {
	if (samples.length === 0) return 0
	const sorted = [...samples].sort((a, b) => a - b)
	return sorted[
		Math.min(sorted.length - 1, Math.floor(sorted.length * percentileValue))
	]
}

function maximum(samples: number[]) {
	return samples.length > 0 ? Math.max(...samples) : 0
}
