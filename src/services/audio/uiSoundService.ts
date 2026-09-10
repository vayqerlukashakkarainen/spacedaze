import { mainSoundVolume } from "../../main"
import { gameSoundService } from "./gameSoundService"

export function playUiHoverSound() {
	gameSoundService.play("ui_hover", {
		volume: mainSoundVolume * 0.7,
	})
}

export function playUiClickSound() {
	gameSoundService.play("ui_click", {
		volume: mainSoundVolume * 0.9,
	})
}

export function playRequirementErrorSound() {
	gameSoundService.play("empty_secondary_error", {
		volume: mainSoundVolume * 0.55,
	})
}
