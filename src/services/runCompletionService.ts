import type { DebreeRunOutcome } from "./debreeEconomyService"
import { recordHubDeposit, type HubDepositResult } from "./hubProgressService"
import { endRunSession } from "./runDirectorService"
import { finishRunStats, type RunStats } from "./runStatsService"
import { finishRunTelemetry } from "./runTelemetryService"

export interface RunEndSummary {
	outcome: RunStats["outcome"]
	debree: DebreeRunOutcome
	hub: HubDepositResult
	run?: RunStats
}

export interface PendingHubLevelReveal {
	previousLevel: number
	currentLevel: number
}

let pendingSummary: RunEndSummary | undefined
let pendingHubLevelReveal: PendingHubLevelReveal | undefined

export function completeRun(outcome: RunStats["outcome"], debree: DebreeRunOutcome) {
	const run = finishRunStats(outcome, debree)
	finishRunTelemetry(outcome, debree)
	const hub = recordHubDeposit(debree.deposited)
	pendingSummary = { outcome, debree, hub, run }
	if (hub.currentLevel > hub.previousLevel) {
		pendingHubLevelReveal = pendingHubLevelReveal
			? {
				previousLevel: Math.min(
					pendingHubLevelReveal.previousLevel,
					hub.previousLevel
				),
				currentLevel: Math.max(
					pendingHubLevelReveal.currentLevel,
					hub.currentLevel
				),
			}
			: {
				previousLevel: hub.previousLevel,
				currentLevel: hub.currentLevel,
			}
	}
	endRunSession()
	return pendingSummary
}

export function consumePendingRunEndSummary() {
	const summary = pendingSummary
	pendingSummary = undefined
	return summary
}

export function clearPendingRunEndSummary() {
	pendingSummary = undefined
}

export function consumePendingHubLevelReveal() {
	const reveal = pendingHubLevelReveal
	pendingHubLevelReveal = undefined
	return reveal
}

export function clearPendingHubLevelReveal() {
	pendingHubLevelReveal = undefined
}
