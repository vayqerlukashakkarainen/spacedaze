export type WeaponId =
	| "standardBlaster"
	| "breachCannon"
	| "arcCarbine"
	| "scatterArray"
	| "burstDriver"
	| "plasmaMortar"
	| "railLance"

export interface WeaponTriggerModifier {
	mode: "press" | "hold" | "charge"
	usesCooldown: boolean
}

export interface WeaponFirePattern {
	projectileCount?: number
	spreadDegrees?: number
	burstCount?: number
	burstInterval?: number
}

export interface WeaponChargeModifier {
	maxDuration: number
	minDamageMultiplier: number
	maxDamageMultiplier: number
	minSpeedMultiplier?: number
	maxSpeedMultiplier?: number
}

export interface WeaponDefinition {
	id: WeaponId
	minimumHubLevel: number
	name: string
	description: string
	icon: string
	damageMultiplier: number
	projectileSpeedMultiplier: number
	fireCooldown: number
	triggerModifier?: WeaponTriggerModifier
	spreadDegrees: number
	mountScale: number
	mountOffsetY: number
	muzzleOffsetY: number
	pattern?: WeaponFirePattern
	charge?: WeaponChargeModifier
	projectileScale?: number
	projectileTint?: [number, number, number]
	lifespan?: number
	splash?: {
		radius: number
		damageMultiplier: number
	}
	knockback?: number
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
		minimumHubLevel: 1,
		name: "STANDARD BLASTER",
		description: "Balanced and dependable. No built-in projectile modifiers.",
		icon: "weapon_standard_blaster",
		damageMultiplier: 1,
		projectileSpeedMultiplier: 1,
		fireCooldown: 0.18,
		triggerModifier: {
			mode: "press",
			usesCooldown: false,
		},
		spreadDegrees: 1.5,
		mountScale: 0.45,
		mountOffsetY: -4,
		muzzleOffsetY: -11,
	},
	{
		id: "breachCannon",
		minimumHubLevel: 2,
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
		minimumHubLevel: 2,
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
	{
		id: "scatterArray",
		minimumHubLevel: 3,
		name: "SCATTER ARRAY",
		description: "Five short-range pellets turn every modifier into a close-range barrage.",
		icon: "weapon_scatter_array",
		damageMultiplier: 0.42,
		projectileSpeedMultiplier: 0.88,
		fireCooldown: 0.52,
		spreadDegrees: 1.2,
		mountScale: 1.2,
		mountOffsetY: -5,
		muzzleOffsetY: -12,
		pattern: {
			projectileCount: 5,
			spreadDegrees: 28,
		},
		lifespan: 0.72,
		knockback: 18,
	},
	{
		id: "burstDriver",
		minimumHubLevel: 3,
		name: "BURST DRIVER",
		description: "Fires three accurate rounds in a tightly timed burst.",
		icon: "weapon_burst_driver",
		damageMultiplier: 0.74,
		projectileSpeedMultiplier: 1.15,
		fireCooldown: 0.46,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 1,
		mountScale: 1.2,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		pattern: {
			burstCount: 3,
			burstInterval: 0.075,
		},
	},
	{
		id: "plasmaMortar",
		minimumHubLevel: 4,
		name: "PLASMA MORTAR",
		description: "Launches a slow, oversized plasma shell with built-in splash damage.",
		icon: "weapon_plasma_mortar",
		damageMultiplier: 1.45,
		projectileSpeedMultiplier: 0.48,
		fireCooldown: 0.68,
		spreadDegrees: 1.5,
		mountScale: 1.2,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		projectileScale: 2,
		projectileTint: [150, 90, 235],
		lifespan: 2.4,
		splash: {
			radius: 66,
			damageMultiplier: 0.7,
		},
		knockback: 34,
	},
	{
		id: "railLance",
		minimumHubLevel: 5,
		name: "RAIL LANCE",
		description: "Hold and release to drive a charged shot through an enemy column.",
		icon: "weapon_rail_lance",
		damageMultiplier: 1.35,
		projectileSpeedMultiplier: 1.8,
		fireCooldown: 0.72,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		spreadDegrees: 0.15,
		mountScale: 1.2,
		mountOffsetY: -6,
		muzzleOffsetY: -15,
		charge: {
			maxDuration: 1.15,
			minDamageMultiplier: 0.55,
			maxDamageMultiplier: 2.5,
			minSpeedMultiplier: 0.8,
			maxSpeedMultiplier: 1.25,
		},
		projectileScale: 2,
		projectileTint: [115, 215, 255],
		piercing: {
			maxPierces: 4,
			damageReduction: 0.9,
		},
		knockback: 48,
	},
]

const DEFAULT_WEAPON_ID: WeaponId = "standardBlaster"
const ALL_WEAPON_IDS = WEAPONS.map((weapon) => weapon.id)

let ownedWeaponIds: WeaponId[] = [DEFAULT_WEAPON_ID]
let equippedWeaponId: WeaponId = DEFAULT_WEAPON_ID

export function getWeaponDefinition(id: WeaponId) {
	return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]
}

export function getEquippedWeapon() {
	return getWeaponDefinition(equippedWeaponId)
}

export function getWeaponTriggerModifier(
	weapon: WeaponDefinition
): WeaponTriggerModifier {
	return weapon.triggerModifier ?? {
		mode: "hold",
		usesCooldown: true,
	}
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

export function unlockWeapon(id: WeaponId) {
	if (!isWeaponOwned(id)) ownedWeaponIds.push(id)
	equippedWeaponId = id
	return true
}

export function resetEquippedWeapon() {
	equippedWeaponId = DEFAULT_WEAPON_ID
}

export function resetWeaponInventory() {
	ownedWeaponIds = [DEFAULT_WEAPON_ID]
	equippedWeaponId = DEFAULT_WEAPON_ID
}

export function setWeaponInventory(
	ownedIds: string[],
	equippedId: string
) {
	const validOwnedIds = ALL_WEAPON_IDS.filter((id) => ownedIds.includes(id))
	ownedWeaponIds = validOwnedIds.includes(DEFAULT_WEAPON_ID)
		? validOwnedIds
		: [DEFAULT_WEAPON_ID, ...validOwnedIds]
	equippedWeaponId = isWeaponId(equippedId) && isWeaponOwned(equippedId)
		? equippedId
		: DEFAULT_WEAPON_ID
}

function isWeaponId(id: string): id is WeaponId {
	return ALL_WEAPON_IDS.includes(id as WeaponId)
}
