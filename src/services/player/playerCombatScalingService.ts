import { player } from "../../player"
import { getEquippedWeapon } from "./weaponService"

const BASE_PRIMARY_DAMAGE = 2

export function getPrimaryWeaponDamage() {
	return player.blasterDmg *
		getEquippedWeapon().damageMultiplier *
		player.blasterDmgMultiplier
}

export function getPrimaryWeaponDamageScale() {
	return getPrimaryWeaponDamage() / BASE_PRIMARY_DAMAGE
}

export function scaleIndependentPlayerDamage(
	baseDamage: number,
	options: {
		includeGlassReactor?: boolean
		movementMultiplier?: number
	} = {}
) {
	const glassReactorMultiplier =
		options.includeGlassReactor !== false && player.glassReactor !== undefined
			? 2
			: 1
	return baseDamage *
		getPrimaryWeaponDamageScale() *
		(options.movementMultiplier ?? 1) *
		glassReactorMultiplier
}

export function getDamageFromPrimaryRatio(
	damageRatio: number,
	options: {
		includeGlassReactor?: boolean
		movementMultiplier?: number
	} = {}
) {
	const glassReactorMultiplier =
		options.includeGlassReactor !== false && player.glassReactor !== undefined
			? 2
			: 1
	return getPrimaryWeaponDamage() *
		damageRatio *
		(options.movementMultiplier ?? 1) *
		glassReactorMultiplier
}
