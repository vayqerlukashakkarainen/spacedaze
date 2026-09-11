import { defineDialogue } from "./defineDialogue"
import { ARMORER_INTRODUCTION_DIALOGUE_ID } from "../../services/hub/armorerService"
import { PRIMARY_WEAPON_REQUIRED_COMPLETED_RUNS } from "../../services/progression/rewardUnlockProgressService"

export const armorerDialogue = defineDialogue({
	introduction: {
		id: ARMORER_INTRODUCTION_DIALOGUE_ID,
		lines: [
			{
				speaker: "ARMORER",
				text: "You will carry more than one firing pattern. You will need the weapon wheel.",
			},
			{
				speaker: "ARMORER",
				text: "Tap {{PRIMARY_WHEEL}} to quick-swap. Hold it to open the wheel.",
			},
			{
				speaker: "ARMORER",
				text: "Point at a weapon and release to equip it. Left click marks favorites for quick-swapping.",
			},
			{
				speaker: "ARMORER",
				text: `The range releases its first primary pattern after ${PRIMARY_WEAPON_REQUIRED_COMPLETED_RUNS} completed runs.`,
			},
			{
				speaker: "ARMORER",
				text: "When it does, bring me a Phase Core. I will reconstruct it.",
			},
		],
	},
	service: {
		id: "armorer-service",
		lines: [
			{
				speaker: "ARMORER",
				text: "Tap {{PRIMARY_WHEEL}} to quick-swap. Hold it, point at a weapon, and release to equip it.",
			},
			{
				speaker: "ARMORER",
				text: "Every cleared primary record over there can be reconstructed with Phase Cores.",
			},
		],
	},
})
