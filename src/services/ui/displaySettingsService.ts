import type { KAPLAYCtx, TimerController } from "kaplay"

interface DisplaySettings {
	screenShakeIntensity: number
	screenFlashIntensity: number
	postProcessingEnabled: boolean
}

const DISPLAY_SETTINGS_KEY = "spacedaze_display_settings_v1"
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
	screenShakeIntensity: 1,
	screenFlashIntensity: 1,
	postProcessingEnabled: false,
}

let settings = loadDisplaySettings()
let effectsInstalled = false
const postProcessingListeners = new Set<(enabled: boolean) => void>()
const disabledFlashTimer: TimerController = {
	timeLeft: 0,
	paused: false,
	cancel: () => {},
	onEnd: (action) => action(),
	then: (action) => {
		action()
		return disabledFlashTimer
	},
}

export function installDisplaySettings(k: KAPLAYCtx) {
	if (effectsInstalled) return
	effectsInstalled = true
	const shake = k.shake.bind(k)
	const flash = k.flash.bind(k)
	k.shake = (intensity = 12) => {
		shake(intensity * settings.screenShakeIntensity)
	}
	k.flash = (color, duration) => {
		if (settings.screenFlashIntensity <= 0) return disabledFlashTimer
		return flash(color, duration * settings.screenFlashIntensity)
	}
}

export function getScreenShakeIntensity() {
	return settings.screenShakeIntensity
}

export function setScreenShakeIntensity(value: number) {
	settings.screenShakeIntensity = normalizeIntensity(value)
	saveDisplaySettings()
}

export function getScreenFlashIntensity() {
	return settings.screenFlashIntensity
}

export function setScreenFlashIntensity(value: number) {
	settings.screenFlashIntensity = normalizeIntensity(value)
	saveDisplaySettings()
}

export function getPostProcessingEnabled() {
	return settings.postProcessingEnabled
}

export function setPostProcessingEnabled(enabled: boolean) {
	if (settings.postProcessingEnabled === enabled) return
	settings.postProcessingEnabled = enabled
	saveDisplaySettings()
	postProcessingListeners.forEach((listener) => listener(enabled))
}

export function onPostProcessingEnabledChange(
	listener: (enabled: boolean) => void
) {
	postProcessingListeners.add(listener)
	return () => postProcessingListeners.delete(listener)
}

function normalizeIntensity(value: number) {
	if (!Number.isFinite(value)) return 1
	return Math.min(1, Math.max(0, value))
}

function loadDisplaySettings(): DisplaySettings {
	if (typeof localStorage === "undefined") {
		return { ...DEFAULT_DISPLAY_SETTINGS }
	}
	try {
		const saved = JSON.parse(
			localStorage.getItem(DISPLAY_SETTINGS_KEY) ?? "{}"
		) as Partial<DisplaySettings>
		return {
			screenShakeIntensity: normalizeIntensity(
				saved.screenShakeIntensity ?? DEFAULT_DISPLAY_SETTINGS.screenShakeIntensity
			),
			screenFlashIntensity: normalizeIntensity(
				saved.screenFlashIntensity ?? DEFAULT_DISPLAY_SETTINGS.screenFlashIntensity
			),
			postProcessingEnabled: typeof saved.postProcessingEnabled === "boolean"
				? saved.postProcessingEnabled
				: DEFAULT_DISPLAY_SETTINGS.postProcessingEnabled,
		}
	} catch {
		return { ...DEFAULT_DISPLAY_SETTINGS }
	}
}

function saveDisplaySettings() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings))
}
