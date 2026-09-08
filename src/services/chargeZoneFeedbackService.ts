import type { AudioPlay } from "kaplay"
import { k, mainSoundVolume } from "../main"
import { audioService } from "./audioService"

const CHARGE_SOUND_UPDATE_STEP = 0.04

export function createChargeZoneFeedback() {
	let chargeSound: AudioPlay | undefined
	let lastSoundProgress = -1

	function stop(reason = "charge-zone-left") {
		if (!chargeSound) return
		audioService.stopSound(chargeSound, reason)
		chargeSound = undefined
		lastSoundProgress = -1
	}

	function update(active: boolean, progress: number) {
		if (!active) {
			stop()
			return
		}

		const clampedProgress = k.clamp(progress, 0, 1)
		if (!chargeSound) {
			chargeSound = audioService.playSound("primary_weapon_charge", {
				volume: mainSoundVolume * 0.2,
				loop: true,
				speed: 0.72,
				detune: -180,
			})
			lastSoundProgress = 0
		}

		if (
			lastSoundProgress >= 0 &&
			Math.abs(clampedProgress - lastSoundProgress) < CHARGE_SOUND_UPDATE_STEP
		) return

		lastSoundProgress = clampedProgress
		audioService.updateSound(chargeSound, {
			volume: mainSoundVolume * k.lerp(0.2, 0.42, clampedProgress),
			speed: k.lerp(0.72, 1.22, clampedProgress),
		})
	}

	return { update, stop }
}
