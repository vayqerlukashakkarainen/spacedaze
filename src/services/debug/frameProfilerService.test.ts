import assert from "node:assert/strict"
import {
	beginProfilerFrame,
	getFrameProfilerSnapshot,
	incrementPerformanceCounter,
	recordSectionTime,
	resetFrameProfiler,
	setFrameProfilerEnabled,
} from "./frameProfilerService"
import {
	formatPerformanceBenchmarkReport,
	startPerformanceBenchmark,
	updatePerformanceBenchmark,
} from "./performanceBenchmarkService"

setFrameProfilerEnabled(true)
resetFrameProfiler()
recordSectionTime("combined", 1.25)
recordSectionTime("combined", 0.75)
incrementPerformanceCounter("primitives", 4)
beginProfilerFrame(10)

let snapshot = getFrameProfilerSnapshot()
assert.equal(snapshot.frameAverage, 10)
assert.equal(snapshot.sections.combined, 2)
assert.equal(snapshot.sectionStats.combined.p95, 2)
assert.equal(snapshot.counters.primitives, 4)

recordSectionTime("combined", 3)
beginProfilerFrame(20)
snapshot = getFrameProfilerSnapshot()
assert.equal(snapshot.frameAverage, 15)
assert.equal(snapshot.sections.combined, 2.5)
assert.equal(snapshot.sectionStats.combined.max, 3)

startPerformanceBenchmark("test-scene", 1)
updatePerformanceBenchmark(1000, 99, false)
updatePerformanceBenchmark(500, 99)
updatePerformanceBenchmark(400, 10)
updatePerformanceBenchmark(600, 14)
const report = formatPerformanceBenchmarkReport()
assert.match(report, /Benchmark test-scene/)
assert.match(report, /Frames 2/)
assert.match(report, /Draws avg 12\.0/)

console.log("Frame profiler tests passed")
