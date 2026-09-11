import assert from "node:assert/strict"
import {
	exponentialBlend,
	frameRateIndependentBlend,
} from "./frameRateService"

const referenceBlend = 0.05
const oneSecondAt30 = repeatedBlend(referenceBlend, 30, 1 / 30)
const oneSecondAt60 = repeatedBlend(referenceBlend, 60, 1 / 60)
const oneSecondAt144 = repeatedBlend(referenceBlend, 144, 1 / 144)

assert.ok(Math.abs(oneSecondAt30 - oneSecondAt60) < 0.0000001)
assert.ok(Math.abs(oneSecondAt144 - oneSecondAt60) < 0.0000001)
assert.ok(
	Math.abs(
		frameRateIndependentBlend(referenceBlend, 1 / 60) - referenceBlend
	) < 0.0000001
)
assert.equal(frameRateIndependentBlend(0, 1), 0)
assert.equal(frameRateIndependentBlend(1, 1 / 144), 1)
assert.equal(frameRateIndependentBlend(referenceBlend, 0), 0)

const response = 5
assert.ok(
	Math.abs(
		repeatedExponentialBlend(response, 30, 1 / 30) -
		repeatedExponentialBlend(response, 144, 1 / 144)
	) < 0.0000001
)

console.log("Frame-rate service tests passed")

function repeatedBlend(blend: number, frames: number, deltaSeconds: number) {
	let value = 0
	for (let frame = 0; frame < frames; frame++) {
		const factor = frameRateIndependentBlend(blend, deltaSeconds)
		value += (1 - value) * factor
	}
	return value
}

function repeatedExponentialBlend(
	response: number,
	frames: number,
	deltaSeconds: number
) {
	let value = 0
	for (let frame = 0; frame < frames; frame++) {
		value += (1 - value) * exponentialBlend(response, deltaSeconds)
	}
	return value
}
