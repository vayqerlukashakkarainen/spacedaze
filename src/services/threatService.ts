const THREAT_TIER_DURATION = 75
const BASE_DEPTH_TIME_OFFSET = 30
const NESTED_RUN_THREAT_REDUCTION = 0.6
const DEPTH_TIME_OFFSET = BASE_DEPTH_TIME_OFFSET * (
	1 - NESTED_RUN_THREAT_REDUCTION
)
const MAX_THREAT_TIER = 5
const THREAT_ECONOMY_STEP = 0.25

export const ENEMY_THREAT_RANK = {
	asteroid: 0,
	swarmDrone: 1,
	fighter: 2,
	genericVehicle: 2,
	assassin: 3,
	rammer: 4,
	heavyVehicle: 5,
	sniper: 6,
	mineLayer: 7,
	hiveMind: 9,
	boss: 10,
} as const

export interface ThreatSnapshot {
	active: boolean
	depth: number
	elapsedSeconds: number
	tier: number
	progress: number
	eliteChance: number
	spawnCountMultiplier: number
	healthMultiplier: number
	damageMultiplier: number
	economyMultiplier: number
}

export interface EnemySpawnOptions {
	elite?: boolean
	disableThreatScaling?: boolean
	persistOffscreen?: boolean
	tags?: string[]
}

export interface EnemySpawnProfile {
	hp: number
	damage: number
	scale: number
	speedMultiplier: number
	elite: boolean
	rewardMultiplier: number
}

let active = false
let depth = 1
let elapsedSeconds = 0
let debugTier: number | undefined

export function startThreatLevel(runDepth: number) {
	active = true
	depth = Math.max(1, Math.floor(runDepth))
	elapsedSeconds = 0
	debugTier = undefined
}

export function updateThreatLevel(deltaSeconds: number) {
	if (!active || deltaSeconds <= 0) return
	elapsedSeconds += deltaSeconds
}

export function addThreatTime(seconds: number) {
	if (!active || seconds <= 0) return
	elapsedSeconds += seconds
}

export function stopThreatLevel() {
	active = false
	depth = 1
	elapsedSeconds = 0
	debugTier = undefined
}

export function setThreatTier(value: number | undefined) {
	debugTier = value === undefined
		? undefined
		: clampTier(Math.round(value))
}

export function getThreatSnapshot(): ThreatSnapshot {
	const effectiveSeconds = elapsedSeconds + (depth - 1) * DEPTH_TIME_OFFSET
	const calculatedTier = clampTier(
		Math.floor(effectiveSeconds / THREAT_TIER_DURATION) + 1
	)
	const tier = debugTier ?? calculatedTier
	const tierStart = (calculatedTier - 1) * THREAT_TIER_DURATION
	const progress = calculatedTier >= MAX_THREAT_TIER
		? 1
		: Math.min(1, Math.max(0, (effectiveSeconds - tierStart) / THREAT_TIER_DURATION))

	return {
		active,
		depth,
		elapsedSeconds,
		tier,
		progress,
		eliteChance: active ? [0, 0.04, 0.08, 0.15, 0.24, 0.34][tier] : 0,
		spawnCountMultiplier: active ? 1 + (tier - 1) * 0.18 : 1,
		healthMultiplier: active ? 1 + (tier - 1) * 0.1 : 1,
		damageMultiplier: active ? 1 + (tier - 1) * 0.07 : 1,
		economyMultiplier: active ? 1 + (tier - 1) * THREAT_ECONOMY_STEP : 1,
	}
}

export function scaleThreatChestCost(baseCost: number) {
	return Math.max(
		1,
		Math.round(baseCost * getThreatSnapshot().economyMultiplier)
	)
}

export function scaleThreatDebreeAmount(baseAmount: number) {
	if (baseAmount <= 0) return 0
	return Math.max(
		1,
		Math.round(baseAmount * getThreatSnapshot().economyMultiplier)
	)
}

export function scaleThreatSpawnCount(baseCount: number) {
	if (baseCount <= 0) return 0
	return Math.max(
		1,
		Math.round(baseCount * getThreatSnapshot().spawnCountMultiplier)
	)
}

export function createEnemySpawnProfile(
	baseHp: number,
	baseDamage: number,
	baseScale: number,
	options: EnemySpawnOptions = {},
	randomValue: number = Math.random()
): EnemySpawnProfile {
	const threat = getThreatSnapshot()
	const usesThreat = threat.active && options.disableThreatScaling !== true
	const elite = options.elite ?? (usesThreat && randomValue < threat.eliteChance)
	const healthMultiplier = usesThreat ? threat.healthMultiplier : 1
	const damageMultiplier = usesThreat ? threat.damageMultiplier : 1
	const eliteHealthMultiplier = elite ? 1.7 : 1
	const eliteDamageMultiplier = elite ? 1.35 : 1
	const eliteScaleMultiplier = elite ? 1.12 : 1

	return {
		hp: Math.max(1, baseHp * healthMultiplier * eliteHealthMultiplier),
		damage: Math.max(0, baseDamage * damageMultiplier * eliteDamageMultiplier),
		scale: baseScale * eliteScaleMultiplier,
		speedMultiplier: elite ? 1.08 : 1,
		elite,
		rewardMultiplier: elite ? 1.75 : 1,
	}
}

export function getThreatRomanNumeral(tier: number) {
	return ["I", "II", "III", "IV", "V"][clampTier(tier) - 1]
}

function clampTier(tier: number) {
	return Math.min(MAX_THREAT_TIER, Math.max(1, tier))
}
