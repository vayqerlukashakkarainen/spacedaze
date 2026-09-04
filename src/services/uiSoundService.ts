import { k, mainSoundVolume } from "../main"
import { audioService } from "./audioService"

const hoverSoundCooldown = 0.035
let lastHoverSoundAt = -Infinity

export function playUiHoverSound() {
	const now = k.time()
	if (now - lastHoverSoundAt < hoverSoundCooldown) return
	lastHoverSoundAt = now
	audioService.playSound("ui_click", {
		volume: mainSoundVolume * 0.7,
	})
}

export function playUiClickSound() {
	audioService.playSound("ui_hover", {
		volume: mainSoundVolume * 0.9,
	})
}

export function playRequirementErrorSound() {
	audioService.playSound("empty_secondary_error", {
		volume: mainSoundVolume * 0.55,
	})
}
