export interface ExtraLifeSnapshot {
	remaining: number
	capacity: number
}

let remaining = 0
let capacity = 0
let runActive = false

export function beginExtraLifeRun(charges: number) {
	runActive = true
	capacity = normalizeCharges(charges)
	remaining = capacity
	return getExtraLifeSnapshot()
}

export function endExtraLifeRun() {
	runActive = false
	remaining = 0
	capacity = 0
}

export function grantExtraLifeCharge() {
	if (!runActive || capacity >= 3) return getExtraLifeSnapshot()
	capacity++
	remaining++
	return getExtraLifeSnapshot()
}

export function refillExtraLifeCharge(amount: number = 1) {
	if (!runActive || capacity <= 0 || !Number.isFinite(amount) || amount <= 0) {
		return getExtraLifeSnapshot()
	}
	remaining = Math.min(capacity, remaining + Math.floor(amount))
	return getExtraLifeSnapshot()
}

export function consumeExtraLife(): ExtraLifeSnapshot | undefined {
	if (remaining <= 0) return undefined
	remaining--
	return getExtraLifeSnapshot()
}

export function getExtraLifeSnapshot(): ExtraLifeSnapshot {
	return { remaining, capacity }
}

function normalizeCharges(charges: number) {
	if (!Number.isFinite(charges)) return 0
	return Math.max(0, Math.min(3, Math.floor(charges)))
}
