import { defineDialogue } from "./defineDialogue"

export const depositAttendantDialogue = defineDialogue({
	explanation: {
		id: "deposit-attendant-explanation",
		lines: [
			{
				speaker: "SALVAGE TENDER",
				text: "Debris in your hold is still exposed. Lose the ship before banking it and the haul is gone.",
			},
			{
				speaker: "SALVAGE TENDER",
				text: "Feed it into this receiver. Deposited debris is secured immediately and restores the hub, even if the run ends later.",
			},
			{
				speaker: "SALVAGE TENDER",
				text: "The receiver seals after one transfer. Find another deposit room if you want to bank a second haul on this floor.",
			},
		],
	},
})
