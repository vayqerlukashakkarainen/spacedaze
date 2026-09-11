import type { Vec2 } from "kaplay"
import { k } from "../../main"
import { getScreenShakeIntensity } from "../ui/displaySettingsService"

interface CameraBobOptions {
	strength: number
	duration: number
	oscillations: number
}

interface ActiveCameraBob extends CameraBobOptions {
	startedAt: number
}

let activeCameraBob: ActiveCameraBob | undefined

interface ActiveCameraKick {
	offset: Vec2
	startedAt: number
	duration: number
}

const CAMERA_KICK_DURATION = 0.18
const CAMERA_KICK_MAX_OFFSET = 3.5

let activeCameraKick: ActiveCameraKick | undefined

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
	const offset = Math.sin(phase) * activeCameraBob.strength * falloff *
		getScreenShakeIntensity()
	return baseScale * (1 + offset)
}

export function clearCameraBob() {
	activeCameraBob = undefined
}

export function addCameraKick(direction: Vec2, strength: number) {
	if (direction.len() <= 0.001 || strength <= 0) return
	const retainedOffset = getRawCameraKickOffset()
	let nextOffset = retainedOffset.add(
		direction.unit().scale(Math.min(CAMERA_KICK_MAX_OFFSET, strength))
	)
	if (nextOffset.len() > CAMERA_KICK_MAX_OFFSET) {
		nextOffset = nextOffset.unit().scale(CAMERA_KICK_MAX_OFFSET)
	}
	activeCameraKick = {
		offset: nextOffset,
		startedAt: k.time(),
		duration: CAMERA_KICK_DURATION,
	}
}

export function getCameraKickOffset() {
	return getRawCameraKickOffset().scale(getScreenShakeIntensity())
}

function getRawCameraKickOffset() {
	if (!activeCameraKick) return k.vec2(0)
	const elapsed = k.time() - activeCameraKick.startedAt
	const progress = k.clamp(elapsed / activeCameraKick.duration, 0, 1)
	if (progress >= 1) {
		activeCameraKick = undefined
		return k.vec2(0)
	}
	const falloff = Math.pow(1 - progress, 2.4)
	return activeCameraKick.offset.scale(falloff)
}

export function clearCameraKick() {
	activeCameraKick = undefined
}
