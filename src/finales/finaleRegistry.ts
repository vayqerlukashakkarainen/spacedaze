import type { FinaleDefinition } from "./finaleTypes"
import { level2Finale } from "./level2Finale"
import { zone1Finale } from "./zone1Finale"

export type FinaleId = "level1Ending" | "level2Ending"

const finales: Record<FinaleId, FinaleDefinition> = {
	level1Ending: zone1Finale,
	level2Ending: level2Finale,
}

export function getFinaleDefinition(id: FinaleId) {
	return finales[id]
}
