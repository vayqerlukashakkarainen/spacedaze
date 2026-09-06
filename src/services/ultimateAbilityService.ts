import { getEquippedUltimateAbilityId } from "./abilityLoadoutService"
import { getAbilityTierValues } from "./abilityTierService"

const BASE_MAX_ULTIMATE_CHARGE = 100

let charge = 0

export function getUltimateCharge() {
	return charge
}

export function getUltimateChargeProgress() {
	return charge / getMaxUltimateCharge()
}

export function grantUltimateCharge(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return charge
	charge = Math.min(getMaxUltimateCharge(), charge + amount)
	return charge
}

export function consumeUltimateCharge() {
	if (charge < getMaxUltimateCharge()) return false
	charge = 0
	return true
}

export function resetUltimateCharge() {
	charge = 0
}

function getMaxUltimateCharge() {
	const abilityId = getEquippedUltimateAbilityId()
	return BASE_MAX_ULTIMATE_CHARGE / getAbilityTierValues(abilityId).recovery
}
