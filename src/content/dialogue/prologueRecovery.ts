import { defineDialogue } from "./defineDialogue"

export const prologueRecoveryDialogue = defineDialogue({
	battlefieldScan: [
		{ speaker: "BURT", text: "They are gone. They have to be gone." },
		{ speaker: "BURT", text: "No Federation transponders. Not yet." },
	],
	wreckInspection: [
		{ speaker: "BURT", text: "You are not Federation." },
		{
			speaker: "BURT",
			text: "Good. I can repair you. Whether I should is a later problem.",
		},
	],
	wormholeExit: [
		{
			speaker: "BURT",
			text: "Wake Station still answers. Move before the Claimkeeper turns around.",
		},
	],
	hubArrival: [
		{ speaker: "BURT", text: "No pursuit. Good. Good." },
	],
	hubRepair: [
		{
			speaker: "BURT",
			text: "Hold still. I can rebuild a ship from five pieces. I have had practice.",
		},
	],
})
