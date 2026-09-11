export const DRONE_FRENZY_DURATION_SECONDS = 5
export const DRONE_FRENZY_DAMAGE_MULTIPLIER = 1.5
export const DRONE_FRENZY_FIRE_RATE_MULTIPLIER = 1.75

interface DroneFrenzyActivation {
	duration?: number
	damageMultiplier?: number
	fireRateMultiplier?: number
}

let remainingSeconds = 0
let damageMultiplier = 1
let fireRateMultiplier = 1

export function activateDroneFrenzy(
	activation: DroneFrenzyActivation = {}
) {
	remainingSeconds = sanitizePositive(
		activation.duration,
		DRONE_FRENZY_DURATION_SECONDS
	)
	damageMultiplier = sanitizeMinimumOne(
		activation.damageMultiplier,
		DRONE_FRENZY_DAMAGE_MULTIPLIER
	)
	fireRateMultiplier = sanitizeMinimumOne(
		activation.fireRateMultiplier,
		DRONE_FRENZY_FIRE_RATE_MULTIPLIER
	)
}

export function updateDroneFrenzy(deltaTime: number) {
	if (!Number.isFinite(deltaTime) || deltaTime <= 0) return
	remainingSeconds = Math.max(0, remainingSeconds - deltaTime)
	if (remainingSeconds > 0) return
	damageMultiplier = 1
	fireRateMultiplier = 1
}

export function resetDroneFrenzy() {
	remainingSeconds = 0
	damageMultiplier = 1
	fireRateMultiplier = 1
}

export function isDroneFrenzyActive() {
	return remainingSeconds > 0
}

export function getDroneFrenzyRemainingSeconds() {
	return remainingSeconds
}

export function getDroneFrenzyDamageMultiplier() {
	return isDroneFrenzyActive() ? damageMultiplier : 1
}

export function getDroneFrenzyFireRateMultiplier() {
	return isDroneFrenzyActive() ? fireRateMultiplier : 1
}

function sanitizePositive(value: number | undefined, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: fallback
}

function sanitizeMinimumOne(value: number | undefined, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) && value >= 1
		? value
		: fallback
}
