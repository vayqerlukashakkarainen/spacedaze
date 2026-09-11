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
	| "breachCannon"
	| "arcCarbine"
	| "scatterArray"
	| "burstDriver"
	| "plasmaMortar"
	| "railLance"
	| "railgun"
	| "phaseBoomerang"
	| "minecaster"

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

export interface WeaponSustainedFireModifier {
	spoolDuration: number
	minimumCooldownMultiplier: number
	maximumSpreadMultiplier: number
	overheat?: {
		heatPerShot: number
		coolingPerSecond: number
		recoveryThreshold: number
	}
}

export interface WeaponHitComboModifier {
	key: string
	requiredHits: number
	finisherDamageMultiplier: number
	duration: number
	color: [number, number, number]
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
	ultimateChargePerHit: number
	projectileSpeedMultiplier: number
	projectileSpeedCap?: number
	fireCooldown: number
	triggerModifier?: WeaponTriggerModifier
	spreadDegrees: number
	mountScale: number
	mountOffsetY: number
	muzzleOffsetY: number
	projectileSpawnOffset?: number
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
	sustainedFire?: WeaponSustainedFireModifier
	hitCombo?: WeaponHitComboModifier
	componentDamageMultiplier?: number
	impactFragment?: {
		count: number
		spreadAngle: number
		damageMultiplier: number
	}
	returning?: {
		delay: number
		speedMultiplier: number
		turnDuration?: number
		trackPlayer?: boolean
		afterBounces?: boolean
	}
	mine?: {
		duration: number
		chance: number
		placementDistance: number
		armDelay: number
		triggerRadius: number
		explosionRadius: number
		damageMultiplier: number
		maxActive?: number
		replaceOldest?: boolean
	}
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
		ultimateChargePerHit: 1,
		projectileSpeedMultiplier: 2.4,
		projectileSpeedCap: 1300,
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
		projectileSpawnOffset: 2,
	},
	{
		id: "pulseRepeater",
		minimumHubLevel: 1,
		name: "PULSE REPEATER",
		description: "Hold to spool into faster low-damage fire. Sustained heat steadily widens the firing pattern.",
		icon: "weapon_pulse_repeater",
		fireSound: "weapon_pulse_repeater_fire",
		fireSoundVolume: 0.6,
		fireSoundDetune: 200,
		damageMultiplier: 0.48,
		ultimateChargePerHit: 0.1,
		projectileSpeedMultiplier: 2.832,
		projectileSpeedCap: 1300,
		projectileLengthScale: 2,
		fireCooldown: 0.075,
		triggerModifier: {
			mode: "hold",
			usesCooldown: true,
		},
		sustainedFire: {
			spoolDuration: 1.8,
			minimumCooldownMultiplier: 0.62,
			maximumSpreadMultiplier: 2.25,
			overheat: {
				heatPerShot: 0.009,
				coolingPerSecond: 0.45,
				recoveryThreshold: 0.15,
			},
		},
		spreadDegrees: 6,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		projectileSpawnOffset: 3,
	},
	{
		id: "twinNeedle",
		minimumHubLevel: 1,
		name: "TWIN NEEDLE",
		description: "Hold and release two weaving needles. Landing both on one target pins it for bonus damage.",
		icon: "weapon_twin_needle",
		fireSound: "weapon_twin_needle_fire",
		fireSoundVolume: 0.7,
		damageMultiplier: 0.58,
		ultimateChargePerHit: 0.5,
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
		projectileSpawnOffset: 3,
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
		hitCombo: {
			key: "twin-needle-pin",
			requiredHits: 2,
			finisherDamageMultiplier: 1.5,
			duration: 1.1,
			color: [90, 220, 255],
		},
	},
	{
		id: "breachCannon",
		minimumHubLevel: 1,
		name: "BREACH CANNON",
		description: "Heavy shots tear through armor and detachable parts, ejecting damaging shrapnel from every impact.",
		icon: "weapon_breach_cannon",
		damageMultiplier: 1.8,
		ultimateChargePerHit: 1.5,
		projectileSpeedMultiplier: 1.728,
		projectileLengthScale: 2,
		fireCooldown: 0.32,
		spreadDegrees: 0.6,
		mountScale: 0.55,
		mountOffsetY: -6,
		muzzleOffsetY: -14,
		projectileSpawnOffset: 2,
		piercing: {
			maxPierces: 2,
			damageReduction: 0.82,
		},
		componentDamageMultiplier: 2.5,
		impactFragment: {
			count: 3,
			spreadAngle: 72,
			damageMultiplier: 0.2,
		},
	},
	{
		id: "arcCarbine",
		minimumHubLevel: 1,
		name: "ARC CARBINE",
		description: "Rapid, lighter fire that arcs to one nearby target.",
		icon: "weapon_arc_carbine",
		fireSound: "shoot1",
		fireSoundVolume: 0.6,
		fireSoundDetune: 350,
		damageMultiplier: 0.72,
		ultimateChargePerHit: 0.4,
		projectileSpeedMultiplier: 2.832,
		projectileSpeedCap: 1300,
		projectileLengthScale: 2,
		fireCooldown: 0.11,
		spreadDegrees: 2.4,
		mountScale: 0.5,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		projectileSpawnOffset: 1,
		chain: {
			maxChains: 1,
			chainDistance: 165,
			damageReduction: 0.65,
		},
	},
	{
		id: "scatterArray",
		minimumHubLevel: 2,
		name: "SCATTER ARRAY",
		description: "Five short-range pellets siphon 5% of damage dealt back into hull.",
		icon: "weapon_scatter_array",
		fireSound: "weapon_scatter_array",
		fireSoundVolume: 0.7,
		damageMultiplier: 0.42,
		ultimateChargePerHit: 0.25,
		projectileSpeedMultiplier: 2.112,
		projectileSpeedCap: 1300,
		projectileLengthScale: 2,
		fireCooldown: 0.52,
		spreadDegrees: 1.2,
		mountScale: 0.6,
		mountOffsetY: -5,
		muzzleOffsetY: -12,
		projectileSpawnOffset: 3,
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
		minimumHubLevel: 2,
		name: "BURST DRIVER",
		description: "Fires three accurate ricocheting rounds. Consecutive hits mark a target and the third consumes the marks for heavy damage.",
		icon: "weapon_burst_driver",
		fireSound: "weapon_burst_driver",
		fireSoundVolume: 0.3,
		damageMultiplier: 0.74,
		ultimateChargePerHit: 0.35,
		projectileSpeedMultiplier: 2.76,
		projectileSpeedCap: 1300,
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
		projectileSpawnOffset: 3,
		pattern: {
			burstCount: 3,
			burstInterval: 0.075,
			burstDamageStep: 0,
		},
		bounce: {
			maxBounces: 1,
		},
		hitCombo: {
			key: "burst-driver-mark",
			requiredHits: 3,
			finisherDamageMultiplier: 1.8,
			duration: 1.4,
			color: [255, 210, 70],
		},
	},
	{
		id: "plasmaMortar",
		minimumHubLevel: 2,
		name: "PLASMA MORTAR",
		description: "Hold and release to launch a charged plasma shell that detonates near enemies.",
		icon: "weapon_plasma_mortar",
		fireSound: "weapon_plasma_mortar_fire",
		fireSoundVolume: 0.85,
		explosionSoundPool: "plasmaMortar",
		explosionSoundVolume: 0.7,
		damageMultiplier: 1.45,
		ultimateChargePerHit: 2,
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
		projectileSpawnOffset: 4,
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
		minimumHubLevel: 3,
		name: "RAIL LANCE",
		description: "Hold and release an almost instantaneous guided line shot through an enemy column.",
		icon: "weapon_rail_lance",
		fireSound: "weapon_rail_lance_fire",
		fireSoundVolume: 0.65,
		damageMultiplier: 1.35,
		ultimateChargePerHit: 2,
		projectileSpeedMultiplier: 9.6,
		projectileLengthScale: 4,
		fireCooldown: 0.72,
		triggerModifier: {
			mode: "charge",
			usesCooldown: true,
		},
		spreadDegrees: 0.15,
		mountScale: 0.6,
		mountOffsetY: -6,
		muzzleOffsetY: -15,
		projectileSpawnOffset: 2,
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
		minimumHubLevel: 3,
		name: "MASS DRIVER",
		description: "Charge a heavy unguided rail bolt through enemy formations. Full charge maximizes speed, force, and penetration.",
		icon: "weapon_railgun",
		fireSound: "weapon_rail_lance_fire",
		fireSoundVolume: 0.85,
		damageMultiplier: 1.55,
		ultimateChargePerHit: 2.5,
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
	{
		id: "phaseBoomerang",
		minimumHubLevel: 2,
		name: "PHASE BOOMERANG",
		description: "Launches an accelerating crescent that knocks targets back, ricochets between enemies, then hunts back toward the moving player.",
		icon: "weapon_phase_boomerang",
		fireSound: "shoot1",
		fireSoundVolume: 0.7,
		fireSoundDetune: -120,
		damageMultiplier: 1.05,
		ultimateChargePerHit: 1,
		projectileSpeedMultiplier: 2.4,
		fireCooldown: 0.48,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 0.4,
		mountScale: 0.58,
		mountOffsetY: -5,
		muzzleOffsetY: -13,
		projectileSpawnOffset: 4,
		projectileSprite: "boomerang_payload_upg1",
		projectileScale: 1.35,
		projectileLengthScale: 1,
		projectileTint: [90, 220, 255],
		projectileSpin: {
			initialSpeed: 380,
			acceleration: 280,
			maxSpeed: 720,
		},
		projectileAcceleration: {
			acceleration: 700,
			maxSpeedMultiplier: 1.15,
		},
		bounce: {
			maxBounces: 2,
			speedRetention: 0.95,
			damageRetention: 0.72,
			seekNextTarget: true,
			seekDistance: 420,
		},
		piercing: {
			maxPierces: 3,
			damageReduction: 0.86,
		},
		returning: {
			delay: 1.2,
			speedMultiplier: 1.3,
			turnDuration: 0.2,
			trackPlayer: true,
			afterBounces: true,
		},
		knockback: 52,
		lifespan: 5,
	},
	{
		id: "minecaster",
		minimumHubLevel: 2,
		name: "MINECASTER",
		description: "Deploys proximity mines that control space. Placing a fourth mine detonates the oldest.",
		icon: "weapon_minecaster",
		fireSound: "shoot1",
		fireSoundVolume: 0.65,
		fireSoundDetune: -420,
		explosionSoundPool: "general",
		explosionSoundVolume: 0.65,
		damageMultiplier: 1.3,
		ultimateChargePerHit: 1.5,
		projectileSpeedMultiplier: 1.15,
		fireCooldown: 0.58,
		triggerModifier: {
			mode: "press",
			usesCooldown: true,
		},
		spreadDegrees: 1.5,
		mountScale: 0.58,
		mountOffsetY: -5,
		muzzleOffsetY: -12,
		projectileSpawnOffset: 4,
		projectileSprite: "room_proximity_mine",
		projectileScale: 0.34,
		projectileLengthScale: 1,
		projectileTint: [170, 190, 200],
		mine: {
			duration: 10,
			chance: 1,
			placementDistance: 76,
			armDelay: 0.4,
			triggerRadius: 38,
			explosionRadius: 64,
			damageMultiplier: 1,
			maxActive: 3,
			replaceOldest: true,
		},
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
