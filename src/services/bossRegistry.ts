export type BossKind = "miniBoss" | "boss"

export interface BossPhaseDefinition {
	id: string
	name: string
	healthThreshold: number
}

export interface BossDefinition {
	id: BossId
	name: string
	subtitle: string
	kind: BossKind
	baseHealth: number
	healthPerRunDepth: number
	minRunDepth: number
	rewardMultiplier: number
	phases: readonly BossPhaseDefinition[]
}

export type BossId = "impact-ace" | "federation-dreadnought"

export const BOSS_REGISTRY: Readonly<Record<BossId, BossDefinition>> = {
	"impact-ace": {
		id: "impact-ace",
		name: "IMPACT ACE",
		subtitle: "FEDERATION RAMMING COMMANDER",
		kind: "miniBoss",
		baseHealth: 26,
		healthPerRunDepth: 4,
		minRunDepth: 2,
		rewardMultiplier: 2.5,
		phases: [
			{ id: "intercept", name: "INTERCEPT", healthThreshold: 1 },
			{ id: "relentless", name: "RELENTLESS", healthThreshold: 0.66 },
			{ id: "terminal-velocity", name: "TERMINAL VELOCITY", healthThreshold: 0.33 },
		],
	},
	"federation-dreadnought": {
		id: "federation-dreadnought",
		name: "FEDERATION DREADNOUGHT",
		subtitle: "MILESTONE BOSS",
		kind: "boss",
		baseHealth: 120,
		healthPerRunDepth: 20,
		minRunDepth: 3,
		rewardMultiplier: 1,
		phases: [
			{ id: "weapons-free", name: "WEAPONS FREE", healthThreshold: 1 },
			{ id: "damaged", name: "DAMAGED", healthThreshold: 0.5 },
		],
	},
}

export function getBossDefinition(id: BossId) {
	return BOSS_REGISTRY[id]
}

export function getBossHealth(id: BossId, runDepth: number) {
	const definition = getBossDefinition(id)
	return definition.baseHealth +
		Math.max(0, Math.floor(runDepth) - definition.minRunDepth) *
		definition.healthPerRunDepth
}

export function getBossPhaseIndex(
	definition: BossDefinition,
	healthRatio: number
) {
	const ratio = Math.max(0, Math.min(1, healthRatio))
	let phaseIndex = 0
	for (let index = 1; index < definition.phases.length; index++) {
		if (ratio <= definition.phases[index].healthThreshold) {
			phaseIndex = index
		}
	}
	return phaseIndex
}
