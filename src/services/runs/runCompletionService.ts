import type { DebreeRunOutcome } from "../economy/debreeEconomyService"
import { recordHubDeposit, type HubDepositResult } from "../hub/hubProgressService"
import { endRunSession } from "./runDirectorService"
import {
	finishRunStats,
	getActiveRunStatsSnapshot,
	type RunStats,
} from "./runStatsService"
import { finishRunTelemetry } from "./runTelemetryService"
import { getPhaseCoresEarnedThisRun } from "../economy/phaseCoreService"

export interface RunEndSummary {
	outcome: RunStats["outcome"]
	debree: DebreeRunOutcome
	hub: HubDepositResult
	phaseCores: number
	run?: RunStats
}

export interface PendingHubLevelReveal {
	previousLevel: number
	currentLevel: number
}

let pendingSummary: RunEndSummary | undefined
let pendingHubLevelReveal: PendingHubLevelReveal | undefined
let hubCreditedThisRun = 0

export function checkpointRun(totalDepositedThisRun: number): RunEndSummary {
	const unsettledDeposit = Math.max(
		0,
		totalDepositedThisRun - hubCreditedThisRun
	)
	const hub = recordHubDeposit(unsettledDeposit)
	hubCreditedThisRun += hub.deposited
	recordPendingHubLevelReveal(hub)
	return {
		outcome: "EXTRACTED",
		debree: { deposited: hub.deposited, lost: 0 },
		hub,
		phaseCores: getPhaseCoresEarnedThisRun(),
		run: getActiveRunStatsSnapshot(totalDepositedThisRun),
	}
}

export function completeRun(outcome: RunStats["outcome"], debree: DebreeRunOutcome) {
	const run = finishRunStats(outcome, debree)
	finishRunTelemetry(outcome, debree)
	const unsettledDeposit = Math.max(0, debree.deposited - hubCreditedThisRun)
	const hub = recordHubDeposit(unsettledDeposit)
	pendingSummary = {
		outcome,
		debree: { ...debree, deposited: unsettledDeposit },
		hub,
		phaseCores: getPhaseCoresEarnedThisRun(),
		run,
	}
	recordPendingHubLevelReveal(hub)
	hubCreditedThisRun = 0
	endRunSession()
	return pendingSummary
}

function recordPendingHubLevelReveal(hub: HubDepositResult) {
	if (hub.currentLevel <= hub.previousLevel) return
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

export function hasPendingHubLevelReveal() {
	return pendingHubLevelReveal !== undefined
}

export function clearPendingHubLevelReveal() {
	pendingHubLevelReveal = undefined
}
