const MAX_ULTIMATE_CHARGE = 100

let charge = 0

export function getUltimateCharge() {
	return charge
}

export function getUltimateChargeProgress() {
	return charge / MAX_ULTIMATE_CHARGE
}

export function grantUltimateCharge(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return charge
	charge = Math.min(MAX_ULTIMATE_CHARGE, charge + amount)
	return charge
}

export function consumeUltimateCharge() {
	if (charge < MAX_ULTIMATE_CHARGE) return false
	charge = 0
	return true
}

export function resetUltimateCharge() {
	charge = 0
}
