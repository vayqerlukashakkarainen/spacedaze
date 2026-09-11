let thrusterParts = 0

export function getThrusterParts() {
	return thrusterParts
}

export function addThrusterParts(amount: number) {
	const added = normalizeAmount(amount)
	thrusterParts += added
	return added
}

export function spendThrusterParts(amount: number) {
	const spent = normalizeAmount(amount)
	if (spent !== amount || thrusterParts < spent) return false
	thrusterParts -= spent
	return true
}

export function loadThrusterParts(amount: number) {
	thrusterParts = normalizeAmount(amount)
}

export function resetThrusterParts() {
	loadThrusterParts(0)
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.round(amount)
}
