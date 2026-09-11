export type PilotProtocolRowId =
	| "navigation"
	| "salvage"
	| "hull"
	| "combat"
	| "mobility"
	| "economy"

export type PilotProtocolId =
	| "signalDecoder"
	| "threatAnalyzer"
	| "securedHold"
	| "restorationTithe"
	| "reinforcedLaunch"
	| "repairPlating"
	| "strafeDoctrine"
	| "impactDoctrine"
	| "phaseCycler"
	| "tetherMomentum"
	| "expandedMarket"
	| "firstPurchaseDiscount"

export interface PilotProtocolDefinition {
	id: PilotProtocolId
	row: PilotProtocolRowId
	name: string
	description: string
	values: readonly number[]
	costs: readonly number[]
}

interface PilotProtocolState {
	ranks: Partial<Record<PilotProtocolId, number>>
	active: Partial<Record<PilotProtocolRowId, PilotProtocolId>>
}

const STORAGE_KEY = "spacedaze_pilot_protocols_v1"

export const PILOT_PROTOCOLS: readonly PilotProtocolDefinition[] = [
	{ id: "signalDecoder", row: "navigation", name: "SIGNAL DECODER", description: "Reveal reward signals farther through the room network.", values: [1, 2, 3], costs: [80, 180, 360] },
	{ id: "threatAnalyzer", row: "navigation", name: "THREAT ANALYZER", description: "Reveal exact threat strength and enemy records nearby.", values: [1, 2, 3], costs: [80, 180, 360] },
	{ id: "securedHold", row: "salvage", name: "SECURED HOLD", description: "Retain carried debris when an expedition is lost.", values: [5, 10, 15], costs: [100, 220, 440] },
	{ id: "restorationTithe", row: "salvage", name: "RESTORATION TITHE", description: "Deposits contribute additional hub restoration progress.", values: [7, 14, 20], costs: [100, 220, 440] },
	{ id: "reinforcedLaunch", row: "hull", name: "REINFORCED LAUNCH", description: "Begin every expedition with additional maximum hull.", values: [5, 10, 15], costs: [120, 260, 520] },
	{ id: "repairPlating", row: "hull", name: "REPAIR PLATING", description: "Excess repairs convert into temporary scrap armor.", values: [20, 35, 50], costs: [120, 260, 520] },
	{ id: "strafeDoctrine", row: "combat", name: "STRAFE DOCTRINE", description: "Gain extra critical chance while a strafe target is acquired.", values: [5, 10, 15], costs: [140, 300, 600] },
	{ id: "impactDoctrine", row: "combat", name: "IMPACT DOCTRINE", description: "Normal-flight impacts deal increased collision damage.", values: [15, 30, 50], costs: [140, 300, 600] },
	{ id: "phaseCycler", row: "mobility", name: "PHASE CYCLER", description: "Reduce phase mobility recharge time.", values: [8, 14, 20], costs: [140, 300, 600] },
	{ id: "tetherMomentum", row: "mobility", name: "TETHER MOMENTUM", description: "Lassoed objects retain more release velocity.", values: [15, 30, 50], costs: [140, 300, 600] },
	{ id: "expandedMarket", row: "economy", name: "EXPANDED MARKET", description: "Run shops carry additional offers.", values: [1, 1, 2], costs: [160, 340, 680] },
	{ id: "firstPurchaseDiscount", row: "economy", name: "OPENING BID", description: "Reduce the first shop purchase on each floor.", values: [10, 20, 30], costs: [160, 340, 680] },
]

const state: PilotProtocolState = loadState()

export function getPilotProtocolRows() {
	return (["navigation", "salvage", "hull", "combat", "mobility", "economy"] as const).map((row) => ({
		id: row,
		protocols: PILOT_PROTOCOLS.filter((protocol) => protocol.row === row),
	}))
}

export function getPilotProtocolRank(id: PilotProtocolId) {
	return state.ranks[id] ?? 0
}

export function getActivePilotProtocol(row: PilotProtocolRowId) {
	return state.active[row]
}

export function isPilotProtocolActive(id: PilotProtocolId) {
	const definition = PILOT_PROTOCOLS.find((protocol) => protocol.id === id)
	return definition !== undefined && state.active[definition.row] === id && getPilotProtocolRank(id) > 0
}

export function getPilotProtocolValue(id: PilotProtocolId) {
	if (!isPilotProtocolActive(id)) return 0
	const definition = PILOT_PROTOCOLS.find((protocol) => protocol.id === id)
	const rank = getPilotProtocolRank(id)
	return definition?.values[rank - 1] ?? 0
}

export function getPilotProtocolUpgradeCost(id: PilotProtocolId) {
	const definition = PILOT_PROTOCOLS.find((protocol) => protocol.id === id)
	return definition?.costs[getPilotProtocolRank(id)]
}

export function upgradePilotProtocol(id: PilotProtocolId) {
	const definition = PILOT_PROTOCOLS.find((protocol) => protocol.id === id)
	if (!definition || getPilotProtocolRank(id) >= definition.values.length) return false
	state.ranks[id] = getPilotProtocolRank(id) + 1
	state.active[definition.row] = id
	saveState()
	return true
}

export function equipPilotProtocol(id: PilotProtocolId) {
	const definition = PILOT_PROTOCOLS.find((protocol) => protocol.id === id)
	if (!definition || getPilotProtocolRank(id) <= 0) return false
	state.active[definition.row] = id
	saveState()
	return true
}

export function resetPilotProtocols() {
	state.ranks = {}
	state.active = {}
	saveState()
}

function loadState(): PilotProtocolState {
	if (typeof localStorage === "undefined") return { ranks: {}, active: {} }
	const saved = localStorage.getItem(STORAGE_KEY)
	if (!saved) return { ranks: {}, active: {} }
	const parsed = JSON.parse(saved) as Partial<PilotProtocolState>
	return { ranks: parsed.ranks ?? {}, active: parsed.active ?? {} }
}

function saveState() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
