export interface PlayerThrusterSoundMix {
	volume: number
	speed: number
}

export const PLAYER_THRUSTER_SOUND_UPDATE_INTERVAL = 1 / 20

const FULL_THRUSTER_SPEED_RATIO = 2
const IDLE_VOLUME = 0.06
const FULL_VOLUME = 0.8
const IDLE_PLAYBACK_SPEED = 0.68
const FULL_PLAYBACK_SPEED = 1.38

export function getPlayerThrusterSoundMix(
	currentSpeed: number,
	baseSpeed: number
): PlayerThrusterSoundMix {
	const safeBaseSpeed = Number.isFinite(baseSpeed) && baseSpeed > 0
		? baseSpeed
		: 1
	const speedRatio = clamp01(
		Math.max(0, finiteOrZero(currentSpeed)) /
			safeBaseSpeed /
			FULL_THRUSTER_SPEED_RATIO
	)
	const response = speedRatio * speedRatio * (3 - 2 * speedRatio)
	return {
		volume: lerp(IDLE_VOLUME, FULL_VOLUME, response),
		speed: lerp(IDLE_PLAYBACK_SPEED, FULL_PLAYBACK_SPEED, response),
	}
}

function finiteOrZero(value: number) {
	return Number.isFinite(value) ? value : 0
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, progress: number) {
	return from + (to - from) * progress
}
