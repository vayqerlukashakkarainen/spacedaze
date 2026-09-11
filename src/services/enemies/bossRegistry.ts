import type { SoundCueId } from "../../audio/soundCueCatalog"

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
	fightStartSound?: SoundCueId
	phases: readonly BossPhaseDefinition[]
}

export type BossId =
	| "impact-ace"
	| "federation-dreadnought"
	| "wake-yardmaster"
	| "wake-last-beacon"

export const BOSS_REGISTRY: Readonly<Record<BossId, BossDefinition>> = {
	"impact-ace": {
		id: "impact-ace",
		name: "IMPACT ACE",
		subtitle: "FEDERATION RAMMING COMMANDER",
		kind: "miniBoss",
		baseHealth: 40,
		healthPerRunDepth: 6,
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
		name: "THE CLAIMKEEPER",
		subtitle: "FEDERATION SALVAGE DREADNOUGHT",
		kind: "boss",
		baseHealth: 600,
		healthPerRunDepth: 100,
		minRunDepth: 3,
		rewardMultiplier: 1,
		fightStartSound: "machine_boss_fight_start",
		phases: [
			{
				id: "collection-protocol",
				name: "COLLECTION PROTOCOL",
				healthThreshold: 1,
			},
			{
				id: "magnetic-seizure",
				name: "MAGNETIC SEIZURE",
				healthThreshold: 0.67,
			},
			{
				id: "dead-man-reactor",
				name: "DEAD-MAN REACTOR",
				healthThreshold: 0.3,
			},
		],
	},
	"wake-yardmaster": {
		id: "wake-yardmaster",
		name: "THE YARDMASTER",
		subtitle: "WAKE AUTONOMOUS SALVAGE FOREMAN",
		kind: "boss",
		baseHealth: 750,
		healthPerRunDepth: 110,
		minRunDepth: 1,
		rewardMultiplier: 1,
		fightStartSound: "machine_boss_fight_start",
		phases: [
			{ id: "clear-the-yard", name: "CLEAR THE YARD", healthThreshold: 1 },
			{ id: "no-material-wasted", name: "NO MATERIAL WASTED", healthThreshold: 0.67 },
			{ id: "foreman-override", name: "FOREMAN OVERRIDE", healthThreshold: 0.3 },
		],
	},
	"wake-last-beacon": {
		id: "wake-last-beacon",
		name: "THE LAST BEACON",
		subtitle: "DISTRICT EMERGENCY SIGNAL",
		kind: "boss",
		baseHealth: 700,
		healthPerRunDepth: 100,
		minRunDepth: 1,
		rewardMultiplier: 1,
		fightStartSound: "machine_boss_fight_start",
		phases: [
			{ id: "evacuation-route", name: "EVACUATION ROUTE", healthThreshold: 1 },
			{ id: "unknown-craft", name: "UNKNOWN CRAFT DETECTED", healthThreshold: 0.67 },
			{ id: "nobody-left", name: "NOBODY LEFT TO WARN", healthThreshold: 0.3 },
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
