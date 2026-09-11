import { hasSeenNpcDialogue } from "../narrative/npcDialogueService"

export const ARMORER_NPC_ID = "armorer"
export const ARMORER_INTRODUCTION_DIALOGUE_ID = "armorer-reconstruction"

export function hasArmorerIntroduction() {
	return hasSeenNpcDialogue(
		ARMORER_NPC_ID,
		ARMORER_INTRODUCTION_DIALOGUE_ID
	)
}

export function getArmorerWeaponCost(minimumHubLevel: number) {
	return Math.max(1, Math.floor(minimumHubLevel))
}
