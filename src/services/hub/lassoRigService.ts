export type LassoRigUpgradeId =
	| "partExtractor"
	| "massCoupler"
	| "forceAmplifier"

export interface LassoRigUpgradeDefinition {
	id: LassoRigUpgradeId
	name: string
	description: string
	sprite: string
	values: readonly number[]
	costs: readonly number[]
}

export interface LassoRigProgress {
	tokens: number
	ranks: Partial<Record<LassoRigUpgradeId, number>>
}

export const LASSO_RIG_UPGRADES: readonly LassoRigUpgradeDefinition[] = [
	{
		id: "partExtractor",
		name: "PART EXTRACTOR",
		description: "Tear detachable parts from hostile ships.",
		sprite: "salvage_lasso",
		values: [1],
		costs: [1],
	},
	{
		id: "massCoupler",
		name: "MASS COUPLER",
		description: "Increase the effective impact mass of every tethered object.",
		sprite: "kinetic_coupler_upg1",
		values: [1.2, 1.4, 1.6],
		costs: [1, 2, 3],
	},
	{
		id: "forceAmplifier",
		name: "FORCE AMPLIFIER",
		description: "Increase lasso pull, part extraction, and throw speed.",
		sprite: "torque_spool_upg1",
		values: [1.15, 1.3, 1.45],
		costs: [1, 2, 3],
	},
]

let progress: LassoRigProgress = createDefaultProgress()

export function getLassoTokens() {
	return progress.tokens
}

export function addLassoTokens(amount: number) {
	const added = normalizeAmount(amount)
	progress.tokens += added
	return added
}

export function spendLassoTokens(amount: number) {
	const spent = normalizeAmount(amount)
	if (spent !== amount || progress.tokens < spent) return false
	progress.tokens -= spent
	return true
}

export function getLassoRigRank(id: LassoRigUpgradeId) {
	return progress.ranks[id] ?? 0
}

export function getLassoRigValue(id: LassoRigUpgradeId) {
	const definition = getLassoRigDefinition(id)
	const rank = getLassoRigRank(id)
	return rank <= 0 ? 1 : definition?.values[rank - 1] ?? 1
}

export function getLassoRigUpgradeCost(id: LassoRigUpgradeId) {
	const definition = getLassoRigDefinition(id)
	return definition?.costs[getLassoRigRank(id)]
}

export function upgradeLassoRig(id: LassoRigUpgradeId) {
	const definition = getLassoRigDefinition(id)
	const rank = getLassoRigRank(id)
	if (!definition || rank >= definition.values.length) return false
	progress.ranks[id] = rank + 1
	return true
}

export function getLassoRigProgress(): LassoRigProgress {
	return {
		tokens: progress.tokens,
		ranks: { ...progress.ranks },
	}
}

export function loadLassoRigProgress(saved?: Partial<LassoRigProgress>) {
	const ranks: Partial<Record<LassoRigUpgradeId, number>> = {}
	for (const definition of LASSO_RIG_UPGRADES) {
		const rank = Math.floor(saved?.ranks?.[definition.id] ?? 0)
		if (rank <= 0) continue
		ranks[definition.id] = Math.min(rank, definition.values.length)
	}
	progress = {
		tokens: normalizeAmount(saved?.tokens ?? 0),
		ranks,
	}
}

export function resetLassoRigProgress() {
	progress = createDefaultProgress()
}

export function getLassoRigDefinition(id: LassoRigUpgradeId) {
	return LASSO_RIG_UPGRADES.find((definition) => definition.id === id)
}

function createDefaultProgress(): LassoRigProgress {
	return { tokens: 0, ranks: {} }
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.floor(amount)
}
