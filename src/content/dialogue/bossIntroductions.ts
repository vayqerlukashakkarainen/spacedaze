import type { BossId } from "../../services/enemies/bossRegistry"
import type { DialogueSection } from "./types"

export const bossIntroductionDialogue: Readonly<Record<BossId, DialogueSection>> = {
	"impact-ace": [
		{
			speaker: "IMPACT ACE",
			text: "INTERCEPT VECTOR LOCKED. IMPACT IS NON-NEGOTIABLE.",
			autoAdvance: true,
			holdAfter: 0.9,
		},
	],
	"federation-dreadnought": [
		{
			speaker: "THE CLAIMKEEPER",
			text: "SALVAGE CLAIM REGISTERED. RESISTANCE WILL BE ITEMIZED.",
			autoAdvance: true,
			holdAfter: 0.9,
		},
	],
	"wake-yardmaster": [
		{
			speaker: "THE YARDMASTER",
			text: "UNSORTED MATERIAL DETECTED. CLEARING THE YARD.",
			autoAdvance: true,
			holdAfter: 0.9,
		},
	],
	"wake-last-beacon": [
		{
			speaker: "THE LAST BEACON",
			text: "EVACUATION SIGNAL ACTIVE. NO SURVIVORS RESPONDING.",
			autoAdvance: true,
			holdAfter: 0.9,
			disturbance: true,
		},
	],
}
