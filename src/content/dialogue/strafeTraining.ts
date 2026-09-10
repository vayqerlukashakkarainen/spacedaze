import { defineDialogue } from "./defineDialogue"

export const strafeTrainingDialogue = defineDialogue({
	offer: {
		failure: [
			{
				speaker: "BURT",
				text: "Back already? The Daze does not forgive sloppy flying.",
			},
			{
				speaker: "BURT",
				text: "Federation patrol echoes know your old flight pattern now.",
			},
		],
		explanation: [
			{
				speaker: "BURT",
				text: "No pilot survives the Void for long without proper strafe control.",
			},
			{
				speaker: "BURT",
				text: "I rebuilt this from a Wake courier stabilizer.",
			},
		],
		ejection: [
			{
				speaker: "BURT",
				text: "You are the only pilot I have left. Close enough. Stand back.",
			},
		],
	},
	tutorial(strafeBinding: string) {
		return defineDialogue({
			explanation: [
				{
					speaker: "BURT",
					text: "That module unlocks strafe control.",
				},
				{
					speaker: "BURT",
					text: `Hold ${strafeBinding} for strafe control. Your hull drifts, but your weapons stay on the cursor.`,
				},
				{
					speaker: "BURT",
					text: "Fly one direction. Fire in another. Federation targeting routines hate that.",
				},
			],
			trainingGrounds: [
				{
					speaker: "BURT",
					text: "The live-fire lane is south of Wake Station. Train there before the Daze teaches you again.",
				},
			],
		})
	},
})
