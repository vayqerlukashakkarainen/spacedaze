import { RewardRarity } from "../types/rewardTypes"
import {
	clearAbilitySlot,
	equipAbility,
	getEquippedSecondaryAbilityId,
} from "./abilityLoadoutService"

export type ActiveModuleId =
	| "rocketPod"
	| "kineticBarrier"
	| "gravityCharge"
	| "breachCharge"
	| "droneBeacon"
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
		cooldown: 6,
		rarity: RewardRarity.Common,
		stats: { ROLE: "DAMAGE", COOLDOWN: "6.0S" },
		crateWeight: 100,
	},
	{
		id: "kineticBarrier",
		minimumHubLevel: 2,
		name: "KINETIC BARRIER",
		shortName: "BARRIER",
		description: "Projects a barrier that blocks all incoming damage for 1.6 seconds.",
		icon: "active_kinetic_barrier",
		cooldown: 10,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "DEFENSE", DURATION: "1.6S", COOLDOWN: "10S" },
		crateWeight: 90,
	},
	{
		id: "gravityCharge",
		minimumHubLevel: 3,
		name: "GRAVITY CHARGE",
		shortName: "GRAVITY",
		description: "Deploys a singularity that pulls enemies, projectiles, and salvage before collapsing.",
		icon: "active_gravity_charge",
		cooldown: 11,
		rarity: RewardRarity.Rare,
		stats: { ROLE: "CONTROL", DURATION: "2.4S", COOLDOWN: "11S" },
		crateWeight: 72,
	},
	{
		id: "breachCharge",
		minimumHubLevel: 2,
		name: "BREACH CHARGE",
		shortName: "BREACH",
		description: "Plants a delayed demolition charge that devastates enemies and destructible walls.",
		icon: "active_breach_charge",
		cooldown: 8,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "BREACH", DAMAGE: 28, COOLDOWN: "8S" },
		crateWeight: 88,
	},
	{
		id: "droneBeacon",
		minimumHubLevel: 3,
		name: "DRONE BEACON",
		shortName: "DRONES",
		description: "Calls in two temporary combat drones for 12 seconds.",
		icon: "active_drone_beacon",
		cooldown: 14,
		rarity: RewardRarity.Rare,
		stats: { ROLE: "SUPPORT", DRONES: 2, DURATION: "12S" },
		crateWeight: 68,
	},
	{
		id: "repairPulse",
		minimumHubLevel: 2,
		name: "REPAIR PULSE",
		shortName: "REPAIR",
		description: "Channels a hull repair over 1.5 seconds. Taking damage interrupts it.",
		icon: "active_repair_pulse",
		cooldown: 12,
		rarity: RewardRarity.Uncommon,
		stats: { ROLE: "RECOVERY", REPAIR: 1, CHANNEL: "1.5S" },
		crateWeight: 82,
	},
	{
		id: "empBeacon",
		minimumHubLevel: 3,
		name: "EMP BEACON",
		shortName: "EMP",
		description: "Disrupts enemies and mines in a wide radius for 3 seconds.",
		icon: "active_emp_beacon",
		cooldown: 13,
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
	return equippedModuleId
		? getActiveModuleDefinition(equippedModuleId)
		: undefined
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
