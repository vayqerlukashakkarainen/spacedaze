import type { NpcDialogueVariant } from "../../services/narrative/npcDialogueService"
import { defineDialogue } from "./defineDialogue"

export const rangeKeeperDialogue = defineDialogue({
	variants: [
		{
			id: "range-introduction",
			minHubLevel: 2,
			lines: [
				{
					speaker: "RANGE KEEPER",
					text: "Contract traffic is active. The Wake once again contains enough pilots to create a safety concern.",
				},
				{
					speaker: "RANGE KEEPER",
					text: "I have volunteered to make it a more accurate safety concern.",
				},
			],
		},
		{
			id: "forge-calibration",
			minHubLevel: 3,
			lines: [
				{
					speaker: "RANGE KEEPER",
					text: "The salvage forge reconstructed my final targeting log from the Claim.",
				},
				{
					speaker: "RANGE KEEPER",
					text: "It reads: CLAIMKEEPER — MISSED. The asteroid has agreed to represent it.",
				},
			],
		},
		{
			id: "range-expansion",
			minHubLevel: 5,
			lines: [
				{
					speaker: "RANGE KEEPER",
					text: "The expanded range provides seventeen new firing angles.",
				},
				{
					speaker: "RANGE KEEPER",
					text: "Next time the Federation arrives, I intend to use all of them.",
				},
			],
		},
		{
			id: "restoration-complete",
			minHubLevel: 8,
			lines: [
				{
					speaker: "RANGE KEEPER",
					text: "Drius Wake is restored. Defensive systems report nominal operation.",
				},
				{
					speaker: "RANGE KEEPER",
					text: "If the Claimkeeper returns, it will find my calibration complete.",
				},
			],
		},
	] satisfies readonly NpcDialogueVariant[],
	hostile: [
		{
			speaker: "RANGE KEEPER",
			text: "STOP MOVING THE TARGET. YOU HAVE BECOME THE TARGET.",
		},
	],
})
