export type WeaponId = "standardBlaster" | "breachCannon" | "arcCarbine"

export interface WeaponDefinition {
	id: WeaponId
	name: string
	description: string
	icon: string
	damageMultiplier: number
	projectileSpeedMultiplier: number
	fireCooldown: number
	spreadDegrees: number
	mountScale: number
	mountOffsetY: number
	muzzleOffsetY: number
	piercing?: {
		maxPierces: number
		damageReduction: number
	}
	chain?: {
		maxChains: number
		chainDistance: number
		damageReduction: number
	}
}

export const WEAPONS: readonly WeaponDefinition[] = [
	{
		id: "standardBlaster",
		name: "STANDARD BLASTER",
		description: "Balanced and dependable. No built-in projectile modifiers.",
		icon: "weapon_standard_blaster",
		damageMultiplier: 1,
		projectileSpeedMultiplier: 1,
		fireCooldown: 0.18,
		spreadDegrees: 1.5,
		mountScale: 0.45,
		mountOffsetY: -4,
		muzzleOffsetY: -11,
	},
	{
		id: "breachCannon",
		name: "BREACH CANNON",
		description: "Heavy, deliberate shots that punch through two additional targets.",
		icon: "weapon_breach_cannon",
		damageMultiplier: 1.8,
		projectileSpeedMultiplier: 0.72,
		fireCooldown: 0.32,
		spreadDegrees: 0.6,
		mountScale: 0.55,
		mountOffsetY: -6,
		muzzleOffsetY: -14,
		piercing: {
			maxPierces: 2,
			damageReduction: 0.82,
		},
	},
	{
		id: "arcCarbine",
		name: "ARC CARBINE",
		description: "Rapid, lighter fire that arcs to one nearby target.",
		icon: "weapon_arc_carbine",
		damageMultiplier: 0.72,
		projectileSpeedMultiplier: 1.18,
		fireCooldown: 0.11,
		spreadDegrees: 2.4,
		mountScale: 0.5,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		chain: {
			maxChains: 1,
			chainDistance: 165,
			damageReduction: 0.65,
		},
	},
]

const DEFAULT_WEAPON_ID: WeaponId = "standardBlaster"
const ALL_WEAPON_IDS = WEAPONS.map((weapon) => weapon.id)

let ownedWeaponIds: WeaponId[] = [...ALL_WEAPON_IDS]
let equippedWeaponId: WeaponId = DEFAULT_WEAPON_ID

export function getWeaponDefinition(id: WeaponId) {
	return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]
}

export function getEquippedWeapon() {
	return getWeaponDefinition(equippedWeaponId)
}

export function getEquippedWeaponId() {
	return equippedWeaponId
}

export function getOwnedWeaponIds() {
	return [...ownedWeaponIds]
}

export function isWeaponOwned(id: WeaponId) {
	return ownedWeaponIds.includes(id)
}

export function equipWeapon(id: WeaponId) {
	if (!isWeaponOwned(id)) return false
	equippedWeaponId = id
	return true
}

export function setWeaponInventory(
	ownedIds: string[],
	equippedId: string
) {
	const validOwnedIds = ALL_WEAPON_IDS.filter((id) => ownedIds.includes(id))
	ownedWeaponIds = validOwnedIds.length > 0 ? validOwnedIds : [...ALL_WEAPON_IDS]
	equippedWeaponId = isWeaponId(equippedId) && isWeaponOwned(equippedId)
		? equippedId
		: DEFAULT_WEAPON_ID
}

function isWeaponId(id: string): id is WeaponId {
	return ALL_WEAPON_IDS.includes(id as WeaponId)
}
