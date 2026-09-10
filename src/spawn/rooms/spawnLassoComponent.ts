import type { Vec2 } from "kaplay"
import { k, mainSoundVolume } from "../../main"
import {
	collectLassoComponent,
} from "../../services/narrative/narrativeService"
import type { Reward } from "../../services/economy/rewardService"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { RewardRarity } from "../../types/rewardTypes"
import { showPopover } from "../../services/ui/popoverService"
import { UI_COLORS } from "../../ui/common"
import { spawnFlash } from "../spawnFlash"
import { spawnRewardPickup } from "../spawnPowerup"

const LASSO_COMPONENT_REWARD: Reward = {
	id: "lassoPhaseTetherCore",
	kind: "item",
	name: "PHASE TETHER CORE",
	description: "A damaged tension core Burt can rebuild into a salvage lasso.",
	stats: { progression: "BURT" },
	sprite: "resonance_coil_upg1",
	rarity: RewardRarity.Legendary,
	progression: {
		persistence: "permanent",
		repeatability: "once",
		rarity: { mode: "fixed", value: RewardRarity.Legendary },
	},
}

export function spawnLassoComponent(
	pos: Vec2,
	options: {
		tags?: string[]
		onCollected?: () => void
	} = {}
) {
	return spawnRewardPickup(pos, LASSO_COMPONENT_REWARD, {
		stationary: true,
		interactionOnly: true,
		interactionRadius: 64,
		interactionPromptStyle: "key",
		interactionPromptLabel: {
			text: "TAKE PHASE TETHER CORE",
			color: k.rgb(...UI_COLORS.warning),
		},
		compactAura: false,
		suppressAcquisition: true,
		tags: options.tags,
		applyEffect: () => collectLassoComponent(),
		onCollected: () => {
			spawnFlash(pos, 16, k.rgb(...UI_COLORS.warning))
			gameSoundService.play("purchase1", {
				volume: mainSoundVolume * 0.85,
				detune: -180,
			})
			showPopover({
				title: "PROGRESSION COMPONENT",
				message: "PHASE TETHER CORE RECOVERED",
				description: "Burt can rebuild this into a salvage lasso.",
				sprite: LASSO_COMPONENT_REWARD.sprite,
				color: k.rgb(...UI_COLORS.warning),
				duration: 4,
			})
			options.onCollected?.()
		},
	})
}
