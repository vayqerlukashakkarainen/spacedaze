import type { FinaleDefinition } from "./finaleTypes"
import { zone1Finale } from "./zone1Finale"

export type FinaleId = "level1Ending"

const finales: Record<FinaleId, FinaleDefinition> = {
	level1Ending: zone1Finale,
}

export function getFinaleDefinition(id: FinaleId) {
	return finales[id]
}
