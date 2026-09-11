import { RewardRarity } from "../../types/rewardTypes"
import {
	clearAbilitySlot,
	equipAbility,
	getEquippedSecondaryAbilityId,
} from "./abilityLoadoutService"
import { getAbilityTierValues } from "./abilityTierService"

export type ActiveModuleId =
	| "rocketPod"
	| "repulsorPulse"
	| "decoyBeacon"
	| "scrapMine"
	| "kineticBarrier"
	| "gravityCharge"
	| "breachCharge"
	| "droneBeacon"
	| "droidFrenzy"
	| "repairPulse"
	| "empBeacon"

export interface ActiveModuleDefinition {
	id: ActiveModuleId
	minimumHubLevel: number
	name: string
	shortName: string
	description: string
	icon: string
	cooldown: number
	rarity: RewardRarity
	stats: Readonly<Record<string, number | string>>
	crateWeight: number
}

export const ACTIVE_MODULES: readonly ActiveModuleDefinition[] = [
	{
		id: "rocketPod",
		minimumHubLevel: 1,
		name: "ROCKET POD",
		shortName: "MISSILE",
		description: "Fires a salvo of guided rockets using your installed missile upgrades.",
		icon: "rocket_upg1",
		cooldown: 30,
		rarity: RewardRarity.Common,
		stats: { ROLE: "DAMAGE", COOLDOWN: "30S" },
		crateWeight: 100,
	},
	{
		id: "repulsorPulse",
		minimumHubLevel: 1,
		name: "REPULSOR PULSE",
		shortName: "REPULSOR",
		description: "Emits a defensive shockwave that throws nearby enemies and hostile projectiles away.",
		icon: "active_repulsor_pulse",
		cooldown: 10.5,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "DEFENSE", RADIUS: 100, COOLDOWN: "10.5S" },
		crateWeight: 105,
	},
	{
		id: "decoyBeacon",
		minimumHubLevel: 1,
		name: "DECOY BEACON",
		shortName: "DECOY",
		description: "Launches a carrier that deploys a holographic ship to draw nearby enemies off course.",
		icon: "active_decoy_beacon",
		cooldown: 13.5,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "CONTROL", DURATION: "5S", COOLDOWN: "13.5S" },
		crateWeight: 96,
	},
	{
		id: "scrapMine",
		minimumHubLevel: 1,
		name: "SCRAP MINE",
		shortName: "MINE",
		description: "Drops an armed proximity mine behind the ship. Deploying another replaces it.",
		icon: "active_scrap_mine",
		cooldown: 9,
		rarity: RewardRarity.Common,
		stats: { ROLE: "DAMAGE", DAMAGE: 16, COOLDOWN: "9S" },
		crateWeight: 112,
	},
	{
		id: "kineticBarrier",
		minimumHubLevel: 2,
		name: "KINETIC BARRIER",
		shortName: "BARRIER",
		description: "Projects a barrier that blocks all incoming damage for 1.6 seconds.",
		icon: "active_kinetic_barrier",
		cooldown: 15,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "DEFENSE", DURATION: "1.6S", COOLDOWN: "15S" },
		crateWeight: 90,
	},
	{
		id: "gravityCharge",
		minimumHubLevel: 3,
		name: "GRAVITY CHARGE",
		shortName: "GRAVITY",
		description: "Launches a carrier that deploys a singularity, pulling enemies, projectiles, and salvage before collapsing.",
		icon: "active_gravity_charge",
		cooldown: 16.5,
		rarity: RewardRarity.Rare,
		stats: { ROLE: "CONTROL", DURATION: "2.4S", COOLDOWN: "16.5S" },
		crateWeight: 72,
	},
	{
		id: "breachCharge",
		minimumHubLevel: 2,
		name: "BREACH CHARGE",
		shortName: "BREACH",
		description: "Launches a carrier that plants a delayed charge, devastating enemies and destructible walls.",
		icon: "active_breach_charge",
		cooldown: 12,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "BREACH", DAMAGE: 28, COOLDOWN: "12S" },
		crateWeight: 88,
	},
	{
		id: "droneBeacon",
		minimumHubLevel: 3,
		name: "DRONE BEACON",
		shortName: "DRONES",
		description: "Launches a carrier that deploys two temporary combat drones for 12 seconds.",
		icon: "active_drone_beacon",
		cooldown: 21,
		rarity: RewardRarity.Rare,
		stats: { ROLE: "SUPPORT", DRONES: 2, DURATION: "12S" },
		crateWeight: 68,
	},
	{
		id: "droidFrenzy",
		minimumHubLevel: 3,
		name: "DROID FRENZY",
		shortName: "FRENZY",
		description: "Overclocks every active droid for 5 seconds, increasing damage and fire rate while granting your projectile modifiers.",
		icon: "active_droid_frenzy",
		cooldown: 18,
		rarity: RewardRarity.Rare,
		stats: {
			ROLE: "DROID BOOST",
			DAMAGE: "+50%",
			"FIRE RATE": "+75%",
			DURATION: "5S",
		},
		crateWeight: 64,
	},
	{
		id: "repairPulse",
		minimumHubLevel: 2,
		name: "REPAIR PULSE",
		shortName: "REPAIR",
		description: "Channels a hull repair over 1.5 seconds. Taking damage interrupts it.",
		icon: "active_repair_pulse",
		cooldown: 40,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "RECOVERY", REPAIR: 25, CHANNEL: "1.5S" },
		crateWeight: 82,
	},
	{
		id: "empBeacon",
		minimumHubLevel: 3,
		name: "EMP BEACON",
		shortName: "EMP",
		description: "Disrupts enemies and mines in a wide radius for 3 seconds.",
		icon: "active_emp_beacon",
		cooldown: 19.5,
		rarity: RewardRarity.Rare,
		stats: { ROLE: "CONTROL", RADIUS: 150, DURATION: "3S" },
		crateWeight: 70,
	},
]

let cooldownRemaining = 0

export function getActiveModuleDefinition(id: ActiveModuleId) {
	return ACTIVE_MODULES.find((module) => module.id === id) ?? ACTIVE_MODULES[0]
}

export function getEquippedActiveModule() {
	const equippedModuleId = getEquippedSecondaryAbilityId()
	if (!equippedModuleId) return undefined
	const module = getActiveModuleDefinition(equippedModuleId)
	const tier = getAbilityTierValues(equippedModuleId)
	return {
		...module,
		cooldown: module.cooldown / tier.recovery,
	}
}

export function getEquippedActiveModuleId() {
	return getEquippedSecondaryAbilityId()
}

export function hasEquippedActiveModule() {
	return getEquippedSecondaryAbilityId() !== undefined
}

export function equipActiveModule(id: ActiveModuleId) {
	equipAbility("secondary", id)
	cooldownRemaining = 0
	return true
}

export function ensureDefaultActiveModule(rocketsUnlocked: boolean) {
	if (!getEquippedSecondaryAbilityId() && rocketsUnlocked) {
		equipActiveModule("rocketPod")
	}
}

export function resetActiveModule() {
	clearAbilitySlot("secondary")
	cooldownRemaining = 0
}

export function resetActiveModuleCooldown() {
	cooldownRemaining = 0
}

export function updateActiveModuleCooldown(deltaTime: number) {
	cooldownRemaining = Math.max(0, cooldownRemaining - deltaTime)
}

export function getActiveModuleCooldownRemaining() {
	return cooldownRemaining
}

export function reduceActiveModuleCooldown(seconds: number) {
	if (!Number.isFinite(seconds) || seconds <= 0) return seconds
	const consumed = Math.min(cooldownRemaining, seconds)
	cooldownRemaining -= consumed
	return seconds - consumed
}

export function beginActiveModuleActivation() {
	const module = getEquippedActiveModule()
	if (!module || cooldownRemaining > 0) return undefined
	cooldownRemaining = module.cooldown
	return module
}

export function isRocketPodEquipped() {
	return getEquippedSecondaryAbilityId() === "rocketPod"
}

export function isActiveModuleId(id: string): id is ActiveModuleId {
	return ACTIVE_MODULES.some((module) => module.id === id)
}
