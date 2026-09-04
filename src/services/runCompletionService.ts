import type { DebreeRunOutcome } from "./debreeEconomyService"
import { recordHubDeposit, type HubDepositResult } from "./hubProgressService"
import { endRunSession } from "./runDirectorService"
import { finishRunStats, type RunStats } from "./runStatsService"

export interface RunEndSummary {
	outcome: RunStats["outcome"]
	debree: DebreeRunOutcome
	hub: HubDepositResult
	run?: RunStats
}

let pendingSummary: RunEndSummary | undefined

export function completeRun(outcome: RunStats["outcome"], debree: DebreeRunOutcome) {
	const run = finishRunStats(outcome, debree)
	const hub = recordHubDeposit(debree.deposited)
	pendingSummary = { outcome, debree, hub, run }
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
