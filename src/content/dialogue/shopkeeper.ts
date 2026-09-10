import { defineDialogue } from "./defineDialogue"

export const shopkeeperDialogue = defineDialogue({
	introduction: [
		{
			speaker: "MARGIN",
			text: "The Daze remembers the Wake. I remember where it kept the expensive parts.",
		},
		{
			speaker: "MARGIN",
			text: "Federation crews declared this stock theirs during the Claim. I found their paperwork unconvincing.",
		},
	],
	conclusion: [
		{
			speaker: "MARGIN",
			text: "You recover Drius Wake. I recover a reasonable margin. Community requires specialization.",
		},
	],
})
