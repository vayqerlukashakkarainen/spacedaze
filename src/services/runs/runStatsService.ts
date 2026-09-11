import { clearSelectedContract } from "../progression/contractService"
import { recordTelemetrySalvageEarned } from "./runTelemetryService"
import type { CombatCredit } from "../progression/combatCredit"
import {
	recordRewardKill,
	recordRewardRunCompleted,
	resetRewardUnlockProgress,
} from "../progression/rewardUnlockProgressService"

const LAST_RUN_KEY = "spacedaze_last_run_v2"
const LIFETIME_STATS_KEY = "spacedaze_lifetime_stats_v1"

export interface LifetimeStats {
	playtimeSeconds: number
	enemiesKilled: number
	runs: number
	completedRuns: number
	deaths: number
	debreeCollected: number
}

export interface RunStats {
	contractName: string
	outcome: "EXTRACTED" | "DESTROYED" | "ABANDONED"
	durationSeconds: number
	kills: number
	salvageEarned: number
	salvageDeposited: number
	salvageLost: number
	rewardsCollected: number
	highestRarity: string
}

interface ActiveRunStats {
	contractName: string
	startedAt: number
	kills: number
	salvageEarned: number
	rewardsCollected: number
	highestRarity: string
}

const rarityRanks: Record<string, number> = {
	NONE: 0,
	COMMON: 1,
	UNCOMMON: 2,
	RARE: 3,
	EPIC: 4,
	LEGENDARY: 5,
}

let activeRun: ActiveRunStats | undefined
let lastRun = loadLastRun()
let lifetimeStats = loadLifetimeStats()
let playtimeSinceSave = 0

export function resetRunStats() {
	activeRun = undefined
	lastRun = undefined
	lifetimeStats = createEmptyLifetimeStats()
	playtimeSinceSave = 0
	localStorage.removeItem(LAST_RUN_KEY)
	localStorage.removeItem(LIFETIME_STATS_KEY)
	resetRewardUnlockProgress()
	clearSelectedContract()
}

export function startRunStats(contractName: string) {
	activeRun = {
		contractName,
		startedAt: performance.now(),
		kills: 0,
		salvageEarned: 0,
		rewardsCollected: 0,
		highestRarity: "NONE",
	}
	lifetimeStats.runs++
	saveLifetimeStats()
}

export function runStatsActive() {
	return activeRun !== undefined
}

export function recordRunKill(combatCredit?: CombatCredit) {
	lifetimeStats.enemiesKilled++
	if (activeRun) activeRun.kills++
	recordRewardKill(combatCredit)
	saveLifetimeStats()
}

export function recordPlayerDeath() {
	lifetimeStats.deaths++
	saveLifetimeStats()
}

export function recordDebreeCollected() {
	lifetimeStats.debreeCollected++
	saveLifetimeStats()
}

export function recordPlaytime(deltaSeconds: number) {
	if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
	lifetimeStats.playtimeSeconds += deltaSeconds
	playtimeSinceSave += deltaSeconds
	if (playtimeSinceSave < 1) return
	playtimeSinceSave = 0
	saveLifetimeStats()
}

export function recordRunSalvage(amount: number) {
	if (!activeRun) return
	activeRun.salvageEarned += amount
	recordTelemetrySalvageEarned(amount)
}

export function recordRunReward(rarity: string) {
	if (!activeRun) return
	activeRun.rewardsCollected++
	if (
		(rarityRanks[rarity] ?? 0) >
		(rarityRanks[activeRun.highestRarity] ?? 0)
	) {
		activeRun.highestRarity = rarity
	}
}

export function finishRunStats(
	outcome: RunStats["outcome"],
	debreeOutcome = { deposited: 0, lost: 0 }
) {
	if (!activeRun) return
	lastRun = {
		contractName: activeRun.contractName,
		outcome,
		durationSeconds: Math.max(
			0,
			Math.round((performance.now() - activeRun.startedAt) / 1000)
		),
		kills: activeRun.kills,
		salvageEarned: activeRun.salvageEarned,
		salvageDeposited: debreeOutcome.deposited,
		salvageLost: debreeOutcome.lost,
		rewardsCollected: activeRun.rewardsCollected,
		highestRarity: activeRun.highestRarity,
	}
	lifetimeStats.completedRuns++
	recordRewardRunCompleted()
	saveLifetimeStats()
	activeRun = undefined
	clearSelectedContract()
	localStorage.setItem(LAST_RUN_KEY, JSON.stringify(lastRun))
	return lastRun
}

export function getActiveRunStatsSnapshot(salvageDeposited = 0) {
	if (!activeRun) return undefined
	return {
		contractName: activeRun.contractName,
		outcome: "EXTRACTED" as const,
		durationSeconds: Math.max(
			0,
			Math.round((performance.now() - activeRun.startedAt) / 1000)
		),
		kills: activeRun.kills,
		salvageEarned: activeRun.salvageEarned,
		salvageDeposited,
		salvageLost: 0,
		rewardsCollected: activeRun.rewardsCollected,
		highestRarity: activeRun.highestRarity,
	}
}

export function getLastRunStats() {
	return lastRun
}

export function getLifetimeStats(): LifetimeStats {
	return { ...lifetimeStats }
}

function loadLastRun(): RunStats | undefined {
	const saved = localStorage.getItem(LAST_RUN_KEY)
	if (!saved) return undefined
	return JSON.parse(saved) as RunStats
}

function loadLifetimeStats(): LifetimeStats {
	const emptyStats = createEmptyLifetimeStats()
	const saved = localStorage.getItem(LIFETIME_STATS_KEY)
	if (!saved) return emptyStats
	const parsed = JSON.parse(saved) as Partial<LifetimeStats>
	return {
		playtimeSeconds: validStat(parsed.playtimeSeconds),
		enemiesKilled: validStat(parsed.enemiesKilled),
		runs: validStat(parsed.runs),
		completedRuns: validStat(parsed.completedRuns ?? parsed.runs),
		deaths: validStat(parsed.deaths),
		debreeCollected: validStat(parsed.debreeCollected),
	}
}

function createEmptyLifetimeStats(): LifetimeStats {
	return {
		playtimeSeconds: 0,
		enemiesKilled: 0,
		runs: 0,
		completedRuns: 0,
		deaths: 0,
		debreeCollected: 0,
	}
}

function validStat(value: number | undefined) {
	return Number.isFinite(value) && value !== undefined && value >= 0 ? value : 0
}

function saveLifetimeStats() {
	localStorage.setItem(LIFETIME_STATS_KEY, JSON.stringify(lifetimeStats))
}
