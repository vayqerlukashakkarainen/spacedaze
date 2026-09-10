import { defineDialogue } from "./defineDialogue"

export const lassoConstructionDialogue = defineDialogue({
	inspection: [
		{
			speaker: "BURT",
			text: "That core is still holding a phase tension. Barely.",
		},
		{
			speaker: "BURT",
			text: "Give me a moment. I can turn it into something that grabs back.",
		},
	],
	construction: [
		{
			speaker: "BURT",
			text: "There. Salvage lasso. It will tow loose objects, explosives, and anything small enough to regret meeting you.",
		},
		{
			speaker: "BURT",
			text: "Collect it before the tether decides I am the loose object.",
		},
	],
	tutorial: {
		panic: [
			{
				speaker: "BURT",
				text: "Good. Excellent grip. Now release me before we test the structural limits of my face.",
			},
		],
		origins: [
			{
				speaker: "BURT",
				text: "The first tether rigs were Wake salvage tools. They pulled wreckage out of unstable phase currents.",
			},
			{
				speaker: "BURT",
				text: "Pilots discovered that debris, explosives, and small attackers are all wreckage if you are sufficiently optimistic.",
			},
			{
				speaker: "BURT",
				text: "Aim at a target and press Q to tether it. Press Q again to release—or throw it while strafing.",
			},
		],
	},
})
