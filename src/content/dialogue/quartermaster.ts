import { defineDialogue } from "./defineDialogue"

export const QUARTERMASTER_NPC_ID = "quartermaster"
export const QUARTERMASTER_INTRODUCTION_DIALOGUE_ID = "quartermaster-introduction"

export const quartermasterDialogue = defineDialogue({
	introduction: {
		id: QUARTERMASTER_INTRODUCTION_DIALOGUE_ID,
		lines: [
			{
				speaker: "QUARTERMASTER",
				text: "Quartermaster. I turn deposited salvage into permanent expedition support.",
			},
			{
				speaker: "QUARTERMASTER",
				text: "Flight records, permanent thruster tuning, emergency repairs, Phase Recall capacity. Once installed, they remain between expeditions.",
			},
			{
				speaker: "QUARTERMASTER",
				text: "Salvage first. Service second. Survival estimates do not qualify as collateral.",
			},
		],
	},
})
