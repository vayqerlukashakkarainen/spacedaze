export type ExpeditionSupportId =
	| "flightRecorder"
	| "emergencyNanites"
	| "launchStipend"

export interface ExpeditionSupportDefinition {
	id: ExpeditionSupportId
	name: string
	description: string
	sprite: string
	values: readonly number[]
	costs: readonly number[]
}

interface ExpeditionSupportState {
	ranks: Partial<Record<ExpeditionSupportId, number>>
}

const STORAGE_KEY = "spacedaze_expedition_support_v1"

export const EXPEDITION_SUPPORT_UPGRADES: readonly ExpeditionSupportDefinition[] = [
	{
		id: "flightRecorder",
		name: "FLIGHT RECORDER",
		description: "Begin each expedition with reward rerolls.",
		sprite: "reroll_token",
		values: [1, 2, 3],
		costs: [1, 2, 3],
	},
	{
		id: "emergencyNanites",
		name: "EMERGENCY NANITES",
		description: "Spawn a recovery shrine at the next sub-level start.",
		sprite: "active_repair_pulse",
		values: [5, 10, 15],
		costs: [1, 2, 3],
	},
	{
		id: "launchStipend",
		name: "LAUNCH STIPEND",
		description: "Begin each expedition with carried debris.",
		sprite: "debree_value_upg1",
		values: [10, 20, 30],
		costs: [1, 2, 3],
	},
]

let state: ExpeditionSupportState = loadState()
let pendingEmergencyNaniteRecovery = 0

export function getExpeditionSupportRank(id: ExpeditionSupportId) {
	return state.ranks[id] ?? 0
}

export function getExpeditionSupportValue(id: ExpeditionSupportId) {
	const definition = getExpeditionSupportDefinition(id)
	const rank = getExpeditionSupportRank(id)
	return rank <= 0 ? 0 : definition?.values[rank - 1] ?? 0
}

export function getExpeditionSupportUpgradeCost(id: ExpeditionSupportId) {
	const definition = getExpeditionSupportDefinition(id)
	return definition?.costs[getExpeditionSupportRank(id)]
}

export function upgradeExpeditionSupport(id: ExpeditionSupportId) {
	const definition = getExpeditionSupportDefinition(id)
	const rank = getExpeditionSupportRank(id)
	if (!definition || rank >= definition.values.length) return false
	state.ranks[id] = rank + 1
	saveState()
	return true
}

export function resetExpeditionSupport() {
	state = { ranks: {} }
	pendingEmergencyNaniteRecovery = 0
	saveState()
}

export function beginExpeditionSupportRun() {
	pendingEmergencyNaniteRecovery = 0
}

export function endExpeditionSupportRun() {
	pendingEmergencyNaniteRecovery = 0
}

export function queueEmergencyNaniteShrine(recovery: number) {
	const amount = Math.max(0, Math.floor(recovery))
	pendingEmergencyNaniteRecovery = Math.max(
		pendingEmergencyNaniteRecovery,
		amount
	)
	return pendingEmergencyNaniteRecovery
}

export function consumeEmergencyNaniteShrine() {
	const recovery = pendingEmergencyNaniteRecovery
	pendingEmergencyNaniteRecovery = 0
	return recovery
}

export function getExpeditionSupportDefinition(id: ExpeditionSupportId) {
	return EXPEDITION_SUPPORT_UPGRADES.find((definition) => definition.id === id)
}

function loadState(): ExpeditionSupportState {
	if (typeof localStorage === "undefined") return { ranks: {} }
	const saved = localStorage.getItem(STORAGE_KEY)
	if (!saved) return { ranks: {} }
	const parsed = JSON.parse(saved) as Partial<ExpeditionSupportState>
	return { ranks: parsed.ranks ?? {} }
}

function saveState() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
