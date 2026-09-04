import type { ActiveModuleId } from "./activeModuleService"
import type { WeaponId } from "./weaponService"

export type AbilitySlot = "primary" | "secondary" | "mobility" | "ultimate"
export type MobilityAbilityId = "thrusterOverdrive" | "phaseJump"
export type UltimateAbilityId = "phaseNova"
export type AbilityId =
	| WeaponId
	| ActiveModuleId
	| MobilityAbilityId
	| UltimateAbilityId

export interface AbilityLoadout {
	primary: WeaponId
	secondary?: ActiveModuleId
	mobility?: MobilityAbilityId
	ultimate?: UltimateAbilityId
}

const DEFAULT_PRIMARY: WeaponId = "standardBlaster"

let loadout: AbilityLoadout = {
	primary: DEFAULT_PRIMARY,
}

export function getAbilityLoadout(): AbilityLoadout {
	return { ...loadout }
}

export function getEquippedAbilityId(slot: AbilitySlot): AbilityId | undefined {
	return loadout[slot]
}

export function getEquippedPrimaryAbilityId() {
	return loadout.primary
}

export function getEquippedSecondaryAbilityId() {
	return loadout.secondary
}

export function getEquippedMobilityAbilityId() {
	return loadout.mobility
}

export function getEquippedUltimateAbilityId() {
	return loadout.ultimate
}

export function equipAbility(slot: "primary", id: WeaponId): void
export function equipAbility(slot: "secondary", id: ActiveModuleId): void
export function equipAbility(slot: "mobility", id: MobilityAbilityId): void
export function equipAbility(slot: "ultimate", id: UltimateAbilityId): void
export function equipAbility(slot: AbilitySlot, id: AbilityId) {
	loadout = { ...loadout, [slot]: id }
}

export function equipAbilityInSlot(slot: AbilitySlot, id: AbilityId) {
	loadout = { ...loadout, [slot]: id }
}

export function clearAbilitySlot(slot: Exclude<AbilitySlot, "primary">) {
	const nextLoadout = { ...loadout }
	delete nextLoadout[slot]
	loadout = nextLoadout
}

export function setAbilityLoadout(next: Partial<AbilityLoadout>) {
	loadout = {
		primary: next.primary ?? DEFAULT_PRIMARY,
		secondary: next.secondary,
		mobility: next.mobility,
		ultimate: next.ultimate,
	}
}

export function resetAbilityLoadout() {
	loadout = { primary: DEFAULT_PRIMARY }
}
