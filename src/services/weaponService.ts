import {
	equipAbility,
	getEquippedPrimaryAbilityId,
} from "./abilityLoadoutService"
import { getAbilityTierValues } from "./abilityTierService"

export type WeaponId =
	| "standardBlaster"
	| "pulseRepeater"
	| "twinNeedle"
	| "impactDriver"
	| "breachCannon"
	| "arcCarbine"
	| "scatterArray"
	| "burstDriver"
	| "plasmaMortar"
	| "railLance"

export interface WeaponTriggerModifier {
	mode: "press" | "hold" | "charge"
	usesCooldown: boolean
	holdCooldown?: number
}

export interface WeaponFirePattern {
	projectileCount?: number
	spreadDegrees?: number
	lateralSpacing?: number
	wiggle?: {
		amplitude: number
		frequency: number
	}
	burstCount?: number
	burstInterval?: number
	burstDamageStep?: number
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
	fireSound?: string
	fireSoundVolume?: number
	fireSoundDetune?: number
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
	projectileSprite?: string
	projectileScale?: number
	projectileTint?: [number, number, number]
	projectileFlash?: boolean
	projectileFlashMinOpacity?: number
	projectileWobble?: number
	explosionDelay?: number
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
	bounce?: {
		maxBounces: number
		speedRetention?: number
		damageRetention?: number
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
		fireSound: "weapon_standard_blaster_fire",
		fireSoundVolume: 0.72,
		damageMultiplier: 1,
		projectileSpeedMultiplier: 1,
		fireCooldown: 0.18,
		triggerModifier: {
			mode: "press",
			usesCooldown: false,
			holdCooldown: 0.3,
		},
		spreadDegrees: 1.5,
		mountScale: 0.45,
		mountOffsetY: -4,
		muzzleOffsetY: -11,
	},
	{
		id: "pulseRepeater",
		minimumHubLevel: 1,
		name: "PULSE REPEATER",
		description: "Hold to unleash rapid low-damage fire with a loose firing pattern.",
		icon: "weapon_pulse_repeater",
		fireSound: "shoot1",
		fireSoundVolume: 0.6,
		fireSoundDetune: 200,
		damageMultiplier: 0.48,
		projectileSpeedMultiplier: 1.18,
		fireCooldown: 0.075,
		triggerModifier: {
			mode: "hold",
			usesCooldown: true,
		},
		spreadDegrees: 6,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
	},
	{
		id: "twinNeedle",
		minimumHubLevel: 1,
		name: "TWIN NEEDLE",
		description: "Fires two lightweight rounds that weave around each other.",
		icon: "weapon_twin_needle",
		fireSound: "shoot1",
		fireSoundDetune: -150,
		damageMultiplier: 0.58,
		projectileSpeedMultiplier: 1.28,
		fireCooldown: 0.22,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 0,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		pattern: {
			projectileCount: 2,
			lateralSpacing: 5,
			wiggle: {
				amplitude: 5,
				frequency: 13,
			},
		},
		bounce: {
			maxBounces: 1,
		},
	},
	{
		id: "impactDriver",
		minimumHubLevel: 1,
		name: "IMPACT DRIVER",
		description: "Launches a slow heavy bolt that violently knocks targets back.",
		icon: "weapon_impact_driver",
		damageMultiplier: 1.55,
		projectileSpeedMultiplier: 0.78,
		fireCooldown: 0.38,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 0.9,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		projectileSprite: "impact_driver_arc_projectile",
		projectileScale: 1.35,
		knockback: 52,
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
		fireSound: "shoot1",
		fireSoundVolume: 0.6,
		fireSoundDetune: 350,
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
		fireSound: "weapon_scatter_array",
		fireSoundVolume: 0.7,
		damageMultiplier: 0.42,
		projectileSpeedMultiplier: 0.88,
		fireCooldown: 0.52,
		spreadDegrees: 1.2,
		mountScale: 0.6,
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
		description: "Fires three accurate rounds. Each round hits 25% harder than the last.",
		icon: "weapon_burst_driver",
		fireSound: "weapon_burst_driver",
		damageMultiplier: 0.74,
		projectileSpeedMultiplier: 1.15,
		fireCooldown: 0.46,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 1,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		pattern: {
			burstCount: 3,
			burstInterval: 0.075,
			burstDamageStep: 0.25,
		},
	},
	{
		id: "plasmaMortar",
		minimumHubLevel: 4,
		name: "PLASMA MORTAR",
		description: "Hold and release to launch a charged plasma shell with built-in splash damage.",
		icon: "weapon_plasma_mortar",
		fireSound: "shoot1",
		fireSoundDetune: -500,
		damageMultiplier: 1.45,
		projectileSpeedMultiplier: 0.48,
		fireCooldown: 0.68,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		spreadDegrees: 1.5,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		charge: {
			maxDuration: 1.15,
			minDamageMultiplier: 0.55,
			maxDamageMultiplier: 2.2,
			minSpeedMultiplier: 0.8,
			maxSpeedMultiplier: 1.15,
		},
		projectileSprite: "plasma_mortar_projectile",
		projectileScale: 1.5,
		projectileTint: [150, 90, 235],
		projectileFlash: true,
		projectileFlashMinOpacity: 0.45,
		projectileWobble: 0.2,
		explosionDelay: 0.2,
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
		fireSound: "shoot1",
		fireSoundDetune: 500,
		damageMultiplier: 1.35,
		projectileSpeedMultiplier: 2.25,
		fireCooldown: 0.72,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		spreadDegrees: 0.15,
		mountScale: 0.6,
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

export function getWeaponDefinition(id: WeaponId) {
	return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]
}

export function getEquippedWeapon() {
	const weapon = getWeaponDefinition(getEquippedPrimaryAbilityId())
	const tier = getAbilityTierValues(weapon.id)
	return {
		...weapon,
		damageMultiplier: weapon.damageMultiplier * tier.power,
		projectileSpeedMultiplier: weapon.projectileSpeedMultiplier * tier.speed,
		fireCooldown: weapon.fireCooldown / tier.recovery,
		triggerModifier: weapon.triggerModifier
			? {
				...weapon.triggerModifier,
				holdCooldown: weapon.triggerModifier.holdCooldown === undefined
					? undefined
					: weapon.triggerModifier.holdCooldown / tier.recovery,
			}
			: undefined,
		splash: weapon.splash
			? {
				...weapon.splash,
				radius: weapon.splash.radius * tier.speed,
				damageMultiplier: weapon.splash.damageMultiplier * tier.power,
			}
			: undefined,
	}
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
	return getEquippedPrimaryAbilityId()
}

export function getOwnedWeaponIds() {
	return [...ownedWeaponIds]
}

export function isWeaponOwned(id: WeaponId) {
	return ownedWeaponIds.includes(id)
}

export function equipWeapon(id: WeaponId) {
	if (!isWeaponOwned(id)) return false
	equipAbility("primary", id)
	return true
}

export function unlockWeapon(id: WeaponId, equip = true) {
	if (!isWeaponOwned(id)) ownedWeaponIds.push(id)
	if (equip) equipAbility("primary", id)
	return true
}

export function resetEquippedWeapon() {
	equipAbility("primary", DEFAULT_WEAPON_ID)
}

export function resetWeaponInventory() {
	ownedWeaponIds = [DEFAULT_WEAPON_ID]
	equipAbility("primary", DEFAULT_WEAPON_ID)
}

export function setWeaponInventory(
	ownedIds: string[],
	equippedId: string
) {
	const validOwnedIds = ALL_WEAPON_IDS.filter((id) => ownedIds.includes(id))
	ownedWeaponIds = validOwnedIds.includes(DEFAULT_WEAPON_ID)
		? validOwnedIds
		: [DEFAULT_WEAPON_ID, ...validOwnedIds]
	equipAbility(
		"primary",
		isWeaponId(equippedId) && isWeaponOwned(equippedId)
			? equippedId
			: DEFAULT_WEAPON_ID
	)
}

function isWeaponId(id: string): id is WeaponId {
	return ALL_WEAPON_IDS.includes(id as WeaponId)
}
