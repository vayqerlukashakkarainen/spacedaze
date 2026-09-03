const SAMPLE_LIMIT = 180

const frameSamples: number[] = []
const sectionSamples = new Map<string, number[]>()

export interface FrameProfilerSnapshot {
	frameAverage: number
	frameP95: number
	frameMax: number
	sections: Record<string, number>
}

export function recordFrameTime(milliseconds: number) {
	pushSample(frameSamples, milliseconds)
}

export function profileSection<T>(name: string, work: () => T): T {
	const startedAt = performance.now()
	const result = work()
	const samples = sectionSamples.get(name) ?? []
	pushSample(samples, performance.now() - startedAt)
	sectionSamples.set(name, samples)
	return result
}

export function getFrameProfilerSnapshot(): FrameProfilerSnapshot {
	return {
		frameAverage: average(frameSamples),
		frameP95: percentile(frameSamples, 0.95),
		frameMax: maximum(frameSamples),
		sections: Object.fromEntries(
			[...sectionSamples.entries()].map(([name, samples]) => [
				name,
				average(samples),
			])
		),
	}
}

export function resetFrameProfiler() {
	frameSamples.length = 0
	sectionSamples.clear()
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
	return sorted[Math.min(
		sorted.length - 1,
		Math.floor(sorted.length * percentileValue)
	)]
}

function maximum(samples: number[]) {
	return samples.length > 0 ? Math.max(...samples) : 0
}
