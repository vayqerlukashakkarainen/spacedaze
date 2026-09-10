import { defineDialogue } from "./defineDialogue"

export function getLampKeeperDialogue(
	litLampCount: number,
	totalLampCount: number
) {
	if (litLampCount >= totalLampCount) {
		return defineDialogue({
			id: "all-lamps-lit",
			observation: [{
				speaker: "LAMP KEEPER",
				text: "All eight are burning. I had forgotten how bright Drius Wake could be.",
			}],
			explanation: [{
				speaker: "LAMP KEEPER",
				text: "The Phase Crown is awake. Lost ships can find us again. So can the Federation.",
			}],
		})
	}
	if (litLampCount === 1) {
		return defineDialogue({
			id: "hub-level-1",
			observation: [{
				speaker: "LAMP KEEPER",
				text: "One of eight lamps is lit. Watch the center of the ring—it records every load of debris you bring home.",
			}],
			explanation: [
				{
					speaker: "LAMP KEEPER",
					text: "Use Salvage Relays inside the Daze to secure debris. Every secured load advances the Hub.",
				},
				{
					speaker: "LAMP KEEPER",
					text: "Deposit enough and another lamp wakes. More light means more of Drius Wake is stable enough to restore.",
				},
			],
		})
	}
	return defineDialogue({
		id: `hub-level-${litLampCount}`,
		observation: [{
			speaker: "LAMP KEEPER",
			text: `${litLampCount} of ${totalLampCount} lamps are lit. Each one holds another district of Drius Wake outside the Daze.`,
		}],
		explanation: [
			{
				speaker: "LAMP KEEPER",
				text: "They are not decoration. Light means another piece of home is stable enough to live in again.",
			},
			{
				speaker: "LAMP KEEPER",
				text: "When all eight burn, the Phase Crown can guide our people home.",
			},
		],
	})
}
