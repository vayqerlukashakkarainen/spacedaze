import { defineDialogue } from "./defineDialogue"

export const RACE_MARSHAL_NPC_ID = "race-marshal"
export const RACE_MARSHAL_DIALOGUE_ID = "race-marshal-restoration"

export const hubRaceDialogue = defineDialogue({
	racerLassoReactions: [
		[
			{
				speaker: "RING RUNNER",
				text: "Hey! Unhook me! You are ruining my line!",
			},
		],
		[
			{
				speaker: "GLOOM",
				text: "Release me. I dislike racing, but I dislike this more.",
			},
		],
		[
			{
				speaker: "JUBILEE",
				text: "Foul! I was about to overtake both of them!",
			},
		],
	],
	raceMarshal: {
		id: RACE_MARSHAL_DIALOGUE_ID,
		observation: [
			{
				speaker: "RACE MARSHAL",
				text: "Three pilots fighting over the same corner. Beautiful.",
			},
		],
		restoration: [
			{
				speaker: "RACE MARSHAL",
				text: "The pirate hub is coming back to life. I am glad I stayed to see it.",
			},
		],
	},
})
