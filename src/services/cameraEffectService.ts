import { k } from "../main"

interface CameraBobOptions {
	strength: number
	duration: number
	oscillations: number
}

interface ActiveCameraBob extends CameraBobOptions {
	startedAt: number
}

let activeCameraBob: ActiveCameraBob | undefined

export function startCameraBob(options: CameraBobOptions) {
	activeCameraBob = {
		...options,
		startedAt: k.time(),
	}
}

export function getCameraBobScale(baseScale: number) {
	if (!activeCameraBob) return baseScale

	const elapsed = k.time() - activeCameraBob.startedAt
	const progress = k.clamp(elapsed / activeCameraBob.duration, 0, 1)
	if (progress >= 1) {
		activeCameraBob = undefined
		return baseScale
	}

	const phase = progress * activeCameraBob.oscillations * Math.PI * 2
	const falloff = Math.pow(1 - progress, 1.6)
	const offset = Math.sin(phase) * activeCameraBob.strength * falloff
	return baseScale * (1 + offset)
}

export function clearCameraBob() {
	activeCameraBob = undefined
}
