import type { Vec2 } from "kaplay"
import { getEquippedUltimateAbilityId } from "./abilityLoadoutService"
import { getAbilityTierValues } from "./abilityTierService"
import type { CombatCredit } from "../progression/combatCredit"

const BASE_MAX_ULTIMATE_CHARGE = 100
const DEFAULT_DAMAGING_HIT_ULTIMATE_CHARGE = 1
const TRAINING_TARGET_ULTIMATE_CHARGE = 7
const ENVIRONMENT_DESTRUCTION_ULTIMATE_CHARGE = 4

export type UltimateChargeDestructionSource = "trainingTarget" | "environment"

let charge = 0
const chargeListeners = new Set<(event: UltimateChargeGainEvent) => void>()

export interface UltimateChargeGainEvent {
	amount: number
	charge: number
	progress: number
	becameReady: boolean
	position?: Vec2
}

export function getUltimateCharge() {
	return charge
}

export function getUltimateChargeProgress() {
	return charge / getMaxUltimateCharge()
}

export function grantUltimateCharge(amount: number, position?: Vec2) {
	if (!getEquippedUltimateAbilityId()) return charge
	if (!Number.isFinite(amount) || amount <= 0) return charge
	const previousCharge = charge
	const maximumCharge = getMaxUltimateCharge()
	charge = Math.min(getMaxUltimateCharge(), charge + amount)
	const grantedAmount = charge - previousCharge
	if (grantedAmount > 0) {
		const event: UltimateChargeGainEvent = {
			amount: grantedAmount,
			charge,
			progress: charge / maximumCharge,
			becameReady: previousCharge < maximumCharge && charge >= maximumCharge,
			position: position?.clone(),
		}
		for (const listener of chargeListeners) listener(event)
	}
	return charge
}

export function onUltimateChargeGranted(
	listener: (event: UltimateChargeGainEvent) => void
) {
	chargeListeners.add(listener)
	return {
		cancel() {
			chargeListeners.delete(listener)
		},
	}
}

export function grantUltimateChargeForDestruction(
	source: UltimateChargeDestructionSource,
	position?: Vec2
) {
	return grantUltimateCharge(
		source === "trainingTarget"
			? TRAINING_TARGET_ULTIMATE_CHARGE
			: ENVIRONMENT_DESTRUCTION_ULTIMATE_CHARGE,
		position
	)
}

export function grantUltimateChargeForHit(
	combatCredit: CombatCredit | undefined,
	position?: Vec2
) {
	if (
		!combatCredit ||
		combatCredit.kind === "ultimate" ||
		combatCredit.kind === "environment"
	) return charge
	return grantUltimateCharge(
		combatCredit.ultimateCharge ?? DEFAULT_DAMAGING_HIT_ULTIMATE_CHARGE,
		position
	)
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
