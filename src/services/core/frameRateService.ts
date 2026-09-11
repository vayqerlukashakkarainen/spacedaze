export const REFERENCE_FRAME_RATE = 60

export function frameRateIndependentBlend(
	referenceFrameBlend: number,
	deltaSeconds: number,
	referenceFrameRate: number = REFERENCE_FRAME_RATE
) {
	const blend = clamp(referenceFrameBlend, 0, 1)
	const elapsed = Math.max(0, deltaSeconds)
	const frameRate = Math.max(1, referenceFrameRate)
	if (blend <= 0 || elapsed <= 0) return 0
	if (blend >= 1) return 1
	return 1 - Math.pow(1 - blend, elapsed * frameRate)
}

export function exponentialBlend(response: number, deltaSeconds: number) {
	return 1 - Math.exp(
		-Math.max(0, response) * Math.max(0, deltaSeconds)
	)
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value))
}
