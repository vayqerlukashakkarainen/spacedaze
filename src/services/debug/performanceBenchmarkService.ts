import {
	getFrameProfilerSnapshot,
	frameProfilerEnabled,
	resetFrameProfiler,
	setFrameProfilerEnabled,
	summarizeSamples,
	type FrameProfilerSnapshot,
} from "./frameProfilerService"

interface ActiveBenchmark {
	name: string
	duration: number
	elapsed: number
	warmupElapsed: number
	frameTimes: number[]
	drawCalls: number[]
	profilerWasEnabled: boolean
}

export interface PerformanceBenchmarkResult {
	name: string
	duration: number
	frames: number
	frameAverage: number
	frameP95: number
	frameMax: number
	drawAverage: number
	drawMax: number
	profiler: FrameProfilerSnapshot
}

let activeBenchmark: ActiveBenchmark | undefined
let lastResult: PerformanceBenchmarkResult | undefined
const BENCHMARK_WARMUP_SECONDS = 0.5

export function startPerformanceBenchmark(name: string, duration: number) {
	const profilerWasEnabled = frameProfilerEnabled()
	setFrameProfilerEnabled(true)
	resetFrameProfiler()
	activeBenchmark = {
		name,
		duration,
		elapsed: 0,
		warmupElapsed: 0,
		frameTimes: [],
		drawCalls: [],
		profilerWasEnabled,
	}
	lastResult = undefined
}

export function updatePerformanceBenchmark(
	frameMs: number,
	drawCalls: number,
	shouldSample = true
) {
	if (!activeBenchmark || !shouldSample) return
	if (activeBenchmark.warmupElapsed < BENCHMARK_WARMUP_SECONDS) {
		activeBenchmark.warmupElapsed += frameMs / 1000
		if (activeBenchmark.warmupElapsed >= BENCHMARK_WARMUP_SECONDS) {
			resetFrameProfiler()
		}
		return
	}
	activeBenchmark.elapsed += frameMs / 1000
	activeBenchmark.frameTimes.push(frameMs)
	activeBenchmark.drawCalls.push(drawCalls)
	if (activeBenchmark.elapsed < activeBenchmark.duration) return

	const frameStats = summarizeSamples(activeBenchmark.frameTimes)
	const drawStats = summarizeSamples(activeBenchmark.drawCalls)
	lastResult = {
		name: activeBenchmark.name,
		duration: activeBenchmark.elapsed,
		frames: activeBenchmark.frameTimes.length,
		frameAverage: frameStats.average,
		frameP95: frameStats.p95,
		frameMax: frameStats.max,
		drawAverage: drawStats.average,
		drawMax: drawStats.max,
		profiler: getFrameProfilerSnapshot(),
	}
	const profilerWasEnabled = activeBenchmark.profilerWasEnabled
	activeBenchmark = undefined
	if (!profilerWasEnabled) setFrameProfilerEnabled(false)
}

export function cancelPerformanceBenchmark() {
	const wasActive = activeBenchmark !== undefined
	const profilerWasEnabled = activeBenchmark?.profilerWasEnabled ?? true
	activeBenchmark = undefined
	if (!profilerWasEnabled) setFrameProfilerEnabled(false)
	return wasActive
}

export function getPerformanceBenchmarkStatus() {
	if (!activeBenchmark) return undefined
	return {
		name: activeBenchmark.name,
		duration: activeBenchmark.duration,
		elapsed: activeBenchmark.elapsed,
	}
}

export function formatPerformanceBenchmarkReport() {
	if (!lastResult) {
		return "No completed benchmark. Use benchmark start <name> [seconds]."
	}
	const result = lastResult
	const sections = Object.entries(result.profiler.sectionStats)
		.sort(([, a], [, b]) => b.average - a.average)
		.map(([name, stats]) =>
			`${name}: avg ${formatMs(stats.average)}, p95 ${formatMs(stats.p95)}, max ${formatMs(stats.max)}`
		)
	return [
		`Benchmark ${result.name}`,
		`Duration ${result.duration.toFixed(2)}s | Frames ${result.frames}`,
		`Frame avg ${formatMs(result.frameAverage)} | p95 ${formatMs(result.frameP95)} | max ${formatMs(result.frameMax)}`,
		`Draws avg ${result.drawAverage.toFixed(1)} | max ${result.drawMax.toFixed(0)}`,
		...sections,
	].join("\n")
}

function formatMs(value: number) {
	return `${value.toFixed(2)}ms`
}
