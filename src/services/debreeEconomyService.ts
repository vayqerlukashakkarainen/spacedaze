export interface DebreeRunOutcome {
	deposited: number
	lost: number
}

export const DEFAULT_DEPOSITED_DEBREE = 60

let depositedDebree = DEFAULT_DEPOSITED_DEBREE
let carriedDebree = 0
let depositedThisRun = 0
let runActive = false

export function beginDebreeRun() {
	carriedDebree = 0
	depositedThisRun = 0
	runActive = true
}

export function debreeRunActive() {
	return runActive
}

export function getAvailableDebree() {
	return runActive ? carriedDebree : depositedDebree
}

export function getCarriedDebree() {
	return carriedDebree
}

export function getDepositedDebree() {
	return depositedDebree
}

export function getDepositedDebreeThisRun() {
	return depositedThisRun
}

export function addAvailableDebree(amount: number) {
	const adjustedAmount = normalizeAmount(amount)
	if (runActive) carriedDebree += adjustedAmount
	else depositedDebree += adjustedAmount
	return adjustedAmount
}

export function spendAvailableDebree(amount: number) {
	const adjustedAmount = normalizeAmount(amount)
	if (adjustedAmount !== amount) return false
	if (getAvailableDebree() < adjustedAmount) return false
	if (runActive) carriedDebree -= adjustedAmount
	else depositedDebree -= adjustedAmount
	return true
}

export function depositCarriedDebree(requestedAmount = carriedDebree) {
	if (!runActive || carriedDebree <= 0) return 0
	const amount = Math.min(carriedDebree, normalizeAmount(requestedAmount))
	if (amount <= 0) return 0
	carriedDebree -= amount
	depositedDebree += amount
	depositedThisRun += amount
	return amount
}

export function extractDebreeRun(): DebreeRunOutcome {
	depositCarriedDebree(carriedDebree)
	const outcome = {
		deposited: depositedThisRun,
		lost: 0,
	}
	finishRun()
	return outcome
}

export function loseCarriedDebree(): DebreeRunOutcome {
	const outcome = {
		deposited: depositedThisRun,
		lost: carriedDebree,
	}
	finishRun()
	return outcome
}

export function loadDepositedDebree(amount: number) {
	depositedDebree = normalizeAmount(amount)
	carriedDebree = 0
	depositedThisRun = 0
	runActive = false
}

export function resetDebreeEconomy() {
	loadDepositedDebree(DEFAULT_DEPOSITED_DEBREE)
}

function finishRun() {
	carriedDebree = 0
	depositedThisRun = 0
	runActive = false
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.round(amount)
}
