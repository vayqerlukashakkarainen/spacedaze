import { defineDialogue } from "./defineDialogue"

export const birthdayPairDialogue = defineDialogue({
	postBirthday: [
		{ speaker: "GLOOM", text: "I hate birthdays…" },
	],
	introduction: [
		{ speaker: "JUBILEE", text: "You look unusually miserable today. Even for you." },
		{ speaker: "GLOOM", text: "I am performing inventory reconciliation." },
	],
	discovery: [
		{
			speaker: "JUBILEE",
			text: [
				{ text: "Wait. ", waitAfter: 0.34 },
				{ text: "GLOOM", reference: { kind: "npc", id: "gloom" } },
				{ text: ", your activation date is today!" },
			],
		},
	],
	celebration: [
		{ speaker: "GLOOM", text: "That information was not intended for recreational use." },
		{
			speaker: "JUBILEE",
			text: [
				{ text: "A village that stops celebrating is just wreckage with power.", waitAfter: 0.34 },
				{ text: " I have exactly the song for this." },
			],
		},
	],
	refusal: [
		{ speaker: "GLOOM", text: "Do not." },
	],
})
