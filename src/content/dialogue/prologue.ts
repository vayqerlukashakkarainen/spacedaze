import { defineDialogue } from "./defineDialogue"

export const prologueDialogue = defineDialogue({
	spacejumpFailure: [
		{
			speaker: "SHIP",
			text: [
				{ text: "SPACEJUMP COORDINATION SYSTEM" },
				{ text: ".", waitAfter: 0.6 },
				{ text: ".", waitAfter: 0.6 },
				{ text: ". ", waitAfter: 0.6 },
				{
					text: "FAILURE.",
					color: [255, 70, 70],
					flash: true,
					sound: { id: "system_error", volume: 0.9 },
					shake: 8,
				},
			],
		},
		{ speaker: "SHIP", text: "DESTINATION LOCK LOST." },
		{
			speaker: "SHIP",
			text: [
				{ text: "INCOMING TRANSMISSION.", waitAfter: 0.5 },
				{ text: " SIGNAL...", waitAfter: 0.6 },
				{ text: " UNKNOWN." },
			],
		},
		{
			speaker: "UNKNOWN",
			text: "...can you hear me? Keep moving. I cannot hold your pattern for long.",
			disturbance: true,
		},
		{ speaker: "SHIP", text: "FOREIGN PHASE SIGNAL DETECTED." },
		{
			speaker: "UNKNOWN",
			text: "Follow the signal. Do not let the Federation lock onto you.",
			disturbance: true,
		},
		{
			speaker: "SHIP",
			autoAdvance: true,
			text: [
				{ text: "LEAVING SPACE JUMP IN... " },
				{ text: "3...", waitAfter: 0.6 },
				{ text: " 2...", waitAfter: 0.6 },
				{ text: " 1... ", waitAfter: 0.6 },
			],
		},
	],
	landed: [
		{
			speaker: "UNKNOWN",
			text: "Your spacejump drive is caught in a phase collapse.",
		},
		{
			speaker: "UNKNOWN",
			text: "Find the active gate. I can pull your pattern through from there.",
		},
		{
			speaker: "UNKNOWN",
			text: [
				{ text: "Move carefully.", waitAfter: 0.4 },
				{ text: " " },
				{ text: "Federation", color: [255, 70, 70] },
				{ text: " search craft are still inside the Daze." },
			],
		},
	],
	hubIntroduction: {
		overview: [
			{
				speaker: "BURT",
				text: "This is Drius Wake. Scavenger port. Pirate village. Home.",
			},
			{
				speaker: "BURT",
				text: [
					{ text: "The " },
					{ text: "Federation", color: [255, 70, 70] },
					{ text: " sent the " },
					{ text: "Claimkeeper", color: [255, 70, 70] },
					{ text: " to salvage it. Buildings, ships, droids—everyone." },
				],
			},
		],
		meeting: [
			{
				speaker: "BURT",
				text: [
					{ text: "There you are.", waitAfter: 0.4 },
					{ text: " Name's Burt. Wake Station held your pattern together. I did the rest." },
				],
			},
		],
		reconstruction: [
			{
				speaker: "BURT",
				text: "The Phase Crown anchors what remains. Feed it debris and it restores one district at a time.",
			},
			{
				speaker: "BURT",
				text: [
					{ text: "It anchors your pattern too.", waitAfter: 0.4 },
					{ text: " Die in the Void and Wake Station pulls you back. Loose debris stays behind." },
				],
			},
		],
		salvageForge: [
			{
				speaker: "BURT",
				text: "That wreck is the Salvage Forge. Rebuild it, and destroyed hostiles yield better rewards.",
			},
		],
		debriefTerminal: [
			{
				speaker: "BURT",
				text: "The Debrief Terminal keeps the record of your last expedition.",
			},
		],
		trainingRange: [
			{
				speaker: "BURT",
				text: "The training grounds hold every weapon you unlock. Swap freely and test them there.",
			},
		],
		contractTerminal: [
			{
				speaker: "BURT",
				text: "The Contract Terminal will prepare expeditions and show what each route offers.",
			},
		],
		confession: [
			{
				speaker: "BURT",
				text: "Your jump failure was not an accident. I bent your signal here. I needed a pilot.",
			},
		],
		phaseVoidGuidance: [
			{
				speaker: "BURT",
				text: [
					{ text: "That gate leads into the " },
					{ text: "Phase Void", color: [180, 120, 255] },
					{ text: ". Scavengers call it the Daze." },
				],
			},
			{
				speaker: "BURT",
				text: "The Crown copied pieces of Wake there during the Claim. Debris still carries their patterns.",
			},
		],
		departure: [
			{
				speaker: "BURT",
				text: "Bring home what the Void remembers. I will rebuild the Wake—and your spacejump drive.",
			},
			{
				speaker: "BURT",
				text: [
					{ text: "Be angry when we are safe.", waitAfter: 0.4 },
					{ text: " Until then, fly." },
				],
			},
		],
	},
})
