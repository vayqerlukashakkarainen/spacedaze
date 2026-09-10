import { RewardRarity } from "../../types/rewardTypes"
import type { SoundCueId } from "../../audio/soundCueCatalog"
import {
	equipAbility,
	getEquippedPrimaryAbilityId,
} from "../abilities/abilityLoadoutService"
import type { ExplosionSoundPoolId } from "../audio/explosionSoundPoolService"
import {
	readProfileSection,
	writeProfileSection,
} from "../progression/profileSaveService"

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
	| "railgun"

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
	autoFireDelay?: number
	minDamageMultiplier: number
	maxDamageMultiplier: number
	minSpeedMultiplier?: number
	maxSpeedMultiplier?: number
	projectileScaleMultiplier?: {
		min: number
		max: number
	}
	piercing?: {
		minPierces: number
		maxPierces: number
		damageReduction?: number
	}
	fireSoundDetune?: {
		min: number
		max: number
	}
}

export interface WeaponProjectileAcceleration {
	acceleration: number
	maxSpeedMultiplier: number
}

export interface WeaponProjectileSpin {
	initialSpeed: number
	acceleration: number
	maxSpeed: number
}

export interface WeaponTargetingGuidance {
	turnSpeed: number
	acquireDelay?: number
}

export interface WeaponDefinition {
	id: WeaponId
	minimumHubLevel: number
	name: string
	description: string
	icon: string
	fireSound?: SoundCueId
	fireSoundVolume?: number
	fireSoundDetune?: number
	explosionSoundPool?: ExplosionSoundPoolId
	explosionSoundVolume?: number
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
	projectileLengthScale: number
	projectileTint?: [number, number, number]
	projectileFlash?: boolean
	projectileFlashMinOpacity?: number
	projectileWobble?: number
	projectileAcceleration?: WeaponProjectileAcceleration
	projectileSpin?: WeaponProjectileSpin
	targetingGuidance?: WeaponTargetingGuidance
	explosionDelay?: number
	lifespan?: number
	splash?: {
		radius: number
		damageMultiplier: number
	}
	proximityRadius?: number
	knockback?: number
	piercing?: {
		maxPierces: number
		damageReduction: number
	}
	bounce?: {
		maxBounces: number
		speedRetention?: number
		damageRetention?: number
		seekNextTarget?: boolean
		seekDistance?: number
	}
	chain?: {
		maxChains: number
		chainDistance: number
		damageReduction: number
	}
	lifesteal?: number
}

export const WEAPONS: readonly WeaponDefinition[] = [
	{
		id: "standardBlaster",
		minimumHubLevel: 1,
		name: "STANDARD BLASTER",
		description: "Balanced and dependable. No built-in projectile modifiers.",
		icon: "weapon_standard_blaster",
		fireSound: "weapon_standard_blaster_fire",
		fireSoundVolume: 0.9,
		damageMultiplier: 1,
		projectileSpeedMultiplier: 2.4,
		projectileLengthScale: 2,
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
		projectileSpeedMultiplier: 2.832,
		projectileLengthScale: 2,
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
		description: "Hold and release two weaving needles. Charge increases their size, damage, and penetration.",
		icon: "weapon_twin_needle",
		fireSound: "weapon_twin_needle_fire",
		fireSoundVolume: 0.7,
		damageMultiplier: 0.58,
		projectileSpeedMultiplier: 3.072,
		projectileLengthScale: 2,
		fireCooldown: 0.22,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		charge: {
			maxDuration: 0.8,
			minDamageMultiplier: 1,
			maxDamageMultiplier: 2.5,
			minSpeedMultiplier: 1,
			maxSpeedMultiplier: 1.4,
			projectileScaleMultiplier: {
				min: 1,
				max: 1.75,
			},
			piercing: {
				minPierces: 0,
				maxPierces: 3,
				damageReduction: 0.82,
			},
			fireSoundDetune: {
				min: -180,
				max: 260,
			},
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
				frequency: 26,
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
		description: "Launches an accelerating heavy bolt that knocks targets back and ricochets toward nearby enemies.",
		icon: "weapon_impact_driver",
		damageMultiplier: 1.55,
		projectileSpeedMultiplier: 0.816,
		projectileLengthScale: 2,
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
		projectileAcceleration: {
			acceleration: 700,
			maxSpeedMultiplier: 1.15,
		},
		projectileSpin: {
			initialSpeed: 90,
			acceleration: 1080,
			maxSpeed: 720,
		},
		bounce: {
			maxBounces: 2,
			speedRetention: 0.95,
			damageRetention: 0.72,
			seekNextTarget: true,
			seekDistance: 420,
		},
		knockback: 52,
	},
	{
		id: "breachCannon",
		minimumHubLevel: 2,
		name: "BREACH CANNON",
		description: "Heavy, deliberate shots that punch through two additional targets.",
		icon: "weapon_breach_cannon",
		damageMultiplier: 1.8,
		projectileSpeedMultiplier: 1.728,
		projectileLengthScale: 2,
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
		projectileSpeedMultiplier: 2.832,
		projectileLengthScale: 2,
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
		description: "Five short-range pellets siphon 5% of damage dealt back into hull.",
		icon: "weapon_scatter_array",
		fireSound: "weapon_scatter_array",
		fireSoundVolume: 0.7,
		damageMultiplier: 0.42,
		projectileSpeedMultiplier: 2.112,
		projectileLengthScale: 2,
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
		lifesteal: 0.05,
	},
	{
		id: "burstDriver",
		minimumHubLevel: 3,
		name: "BURST DRIVER",
		description: "Fires three accurate rounds. Each round hits 25% harder than the last.",
		icon: "weapon_burst_driver",
		fireSound: "weapon_burst_driver",
		fireSoundVolume: 0.5,
		damageMultiplier: 0.74,
		projectileSpeedMultiplier: 2.76,
		projectileLengthScale: 2,
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
		bounce: {
			maxBounces: 1,
		},
	},
	{
		id: "plasmaMortar",
		minimumHubLevel: 4,
		name: "PLASMA MORTAR",
		description: "Hold and release to launch a charged plasma shell that detonates near enemies.",
		icon: "weapon_plasma_mortar",
		fireSound: "weapon_plasma_mortar_fire",
		fireSoundVolume: 0.85,
		explosionSoundPool: "plasmaMortar",
		explosionSoundVolume: 0.7,
		damageMultiplier: 1.45,
		projectileSpeedMultiplier: 1.152,
		projectileLengthScale: 2,
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
			fireSoundDetune: {
				min: -600,
				max: 0,
			},
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
		proximityRadius: 22,
		knockback: 34,
	},
	{
		id: "railLance",
		minimumHubLevel: 5,
		name: "RAIL LANCE",
		description: "Hold and release to drive a charged shot through an enemy column. Locked Strafe Mode shots steer toward their target.",
		icon: "weapon_rail_lance",
		fireSound: "weapon_rail_lance_fire",
		fireSoundVolume: 0.65,
		damageMultiplier: 1.35,
		projectileSpeedMultiplier: 5.4,
		projectileLengthScale: 2,
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
			fireSoundDetune: {
				min: -450,
				max: 500,
			},
		},
		projectileScale: 2,
		projectileTint: [115, 215, 255],
		targetingGuidance: {
			turnSpeed: 0.014,
			acquireDelay: 0,
		},
		piercing: {
			maxPierces: 4,
			damageReduction: 0.9,
		},
		knockback: 48,
	},
	{
		id: "railgun",
		minimumHubLevel: 6,
		name: "MASS DRIVER",
		description: "Charge a heavy unguided rail bolt through enemy formations. Full charge maximizes speed, force, and penetration.",
		icon: "weapon_railgun",
		fireSound: "weapon_rail_lance_fire",
		fireSoundVolume: 0.85,
		damageMultiplier: 1.55,
		projectileSpeedMultiplier: 4.2,
		projectileLengthScale: 2,
		fireCooldown: 0.9,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		spreadDegrees: 0,
		mountScale: 0.68,
		mountOffsetY: -7,
		muzzleOffsetY: -17,
		charge: {
			maxDuration: 1.2,
			autoFireDelay: 0.3,
			minDamageMultiplier: 0.55,
			maxDamageMultiplier: 3.1,
			minSpeedMultiplier: 0.7,
			maxSpeedMultiplier: 1.9,
			projectileScaleMultiplier: {
				min: 0.8,
				max: 2.2,
			},
			piercing: {
				minPierces: 1,
				maxPierces: 6,
				damageReduction: 0.88,
			},
			fireSoundDetune: {
				min: -500,
				max: 300,
			},
		},
		projectileScale: 3,
		projectileTint: [255, 210, 55],
		knockback: 70,
	},
]

const DEFAULT_WEAPON_ID: WeaponId = "standardBlaster"
const ALL_WEAPON_IDS = WEAPONS.map((weapon) => weapon.id)

let ownedWeaponIds: WeaponId[] = [DEFAULT_WEAPON_ID]
let favoriteWeaponIds = loadFavoriteWeaponIds()

export function getWeaponDefinition(id: WeaponId) {
	return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]
}

export function getWeaponRewardRarity(id: WeaponId) {
	return id === DEFAULT_WEAPON_ID
		? RewardRarity.Common
		: RewardRarity.Legendary
}

export function getEquippedWeapon() {
	return getWeaponDefinition(getEquippedPrimaryAbilityId())
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

export function getFavoriteWeaponIds() {
	return favoriteWeaponIds.filter(isWeaponOwned)
}

export function isWeaponFavorite(id: WeaponId) {
	return favoriteWeaponIds.includes(id)
}

export function toggleWeaponFavorite(id: WeaponId) {
	if (!isWeaponOwned(id)) return false
	if (isWeaponFavorite(id)) {
		favoriteWeaponIds = favoriteWeaponIds.filter((weaponId) => weaponId !== id)
	} else {
		favoriteWeaponIds = [...favoriteWeaponIds, id]
	}
	saveFavoriteWeaponIds()
	return isWeaponFavorite(id)
}

export function isWeaponOwned(id: WeaponId) {
	return ownedWeaponIds.includes(id)
}

export function equipWeapon(id: WeaponId) {
	if (!isWeaponOwned(id)) return false
	equipAbility("primary", id)
	return true
}

export function cycleEquippedWeapon(direction: -1 | 1) {
	const favorites = getFavoriteWeaponIds()
	const arsenal = favorites.length > 0
		? favorites
		: ALL_WEAPON_IDS.filter(isWeaponOwned)
	if (arsenal.length === 0) return getEquippedWeapon()
	const currentIndex = arsenal.indexOf(getEquippedPrimaryAbilityId())
	if (currentIndex < 0) {
		const nextId = direction > 0 ? arsenal[0] : arsenal[arsenal.length - 1]
		equipAbility("primary", nextId)
		return getEquippedWeapon()
	}
	const nextIndex = (
		currentIndex + direction + arsenal.length
	) % arsenal.length
	equipAbility("primary", arsenal[nextIndex])
	return getEquippedWeapon()
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
	favoriteWeaponIds = []
	saveFavoriteWeaponIds()
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

function loadFavoriteWeaponIds() {
	const preferences = readProfileSection<{ favoriteWeaponIds?: unknown }>(
		"preferences"
	)
	const savedFavoriteIds = preferences?.favoriteWeaponIds
	if (!Array.isArray(savedFavoriteIds)) return []
	return [...new Set(savedFavoriteIds.filter((id): id is WeaponId =>
		typeof id === "string" && isWeaponId(id)
	))]
}

function saveFavoriteWeaponIds() {
	const preferences = readProfileSection<Record<string, unknown>>(
		"preferences"
	) ?? {}
	writeProfileSection("preferences", {
		...preferences,
		favoriteWeaponIds: [...favoriteWeaponIds],
	})
}
