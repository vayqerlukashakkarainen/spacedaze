import type { GameObj, PosComp } from "kaplay"
import { k, mainSoundVolume } from "../main"
import { onUltimateChargeGranted } from "../services/abilities/ultimateAbilityService"
import { gameSoundService } from "../services/audio/gameSoundService"
import type { InputController } from "../services/input/inputBindingService"
import {
	pulseUltimateChargeUi,
	showUltimateReadyAnnouncement,
} from "../ui/gameUi"
import { spawnFlash } from "./spawnFlash"
import { spawnChainProjectile } from "./spawnLink"

const ULTIMATE_CHARGE_COLOR = [255, 142, 36] as const

export function installUltimateChargeOrbFeedback(
	player: GameObj<PosComp>
): InputController {
	return onUltimateChargeGranted((event) => {
		if (!player.exists()) return
		const start = event.position?.clone() ?? player.pos.clone()
		const distance = start.dist(player.pos)
		const size = k.clamp(1.5 + Math.sqrt(event.amount) * 1.35, 1.8, 8)
		spawnChainProjectile({
			pos1: start,
			pos2: player.pos.clone(),
			target: player,
			decayTime: Math.max(0.28, distance / 850 * 0.68),
			color: k.rgb(...ULTIMATE_CHARGE_COLOR),
			opacity: 0.4,
			size,
			onArrive: () => {
				if (!player.exists()) return
				pulseUltimateChargeUi(event.amount)
				spawnFlash(player.pos.clone(), size + 2, k.rgb(...ULTIMATE_CHARGE_COLOR))
				if (!event.becameReady) return
				showUltimateReadyAnnouncement()
				gameSoundService.play("powerup1", {
					volume: mainSoundVolume * 0.8,
					detune: 180,
				})
			},
		})
	})
}
