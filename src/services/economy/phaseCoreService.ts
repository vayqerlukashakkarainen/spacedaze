let phaseCores = 0
let earnedThisRun = 0

export function beginPhaseCoreRun() {
	earnedThisRun = 0
}

export function getPhaseCores() {
	return phaseCores
}

export function getPhaseCoresEarnedThisRun() {
	return earnedThisRun
}

export function addPhaseCores(amount: number, countAsRunReward = false) {
	const added = normalizeAmount(amount)
	phaseCores += added
	if (countAsRunReward) earnedThisRun += added
	return added
}

export function spendPhaseCores(amount: number) {
	const spent = normalizeAmount(amount)
	if (spent !== amount || phaseCores < spent) return false
	phaseCores -= spent
	return true
}

export function loadPhaseCores(amount: number) {
	phaseCores = normalizeAmount(amount)
	earnedThisRun = 0
}

export function resetPhaseCores() {
	loadPhaseCores(0)
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.round(amount)
}
