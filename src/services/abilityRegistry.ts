import { RewardRarity, type RewardSource } from "../types/rewardTypes"
import {
	ACTIVE_MODULES,
	type ActiveModuleId,
} from "./activeModuleService"
import {
	type AbilityId,
	type AbilitySlot,
	type MobilityAbilityId,
	type UltimateAbilityId,
} from "./abilityLoadoutService"
import {
	discoverBlueprint,
	isBlueprintDiscovered,
} from "./hubProgressService"
import {
	getWeaponTriggerModifier,
	type WeaponId,
	unlockWeapon,
	WEAPONS,
} from "./weaponService"

export type AbilityResource =
	| { type: "none" }
	| { type: "cooldown"; duration: number }
	| { type: "charges"; count: number; recharge: number }
	| { type: "meter"; required: number }

export interface AbilityDefinition {
	id: AbilityId
	slot: AbilitySlot
	name: string
	description: string
	icon: string
	minimumHubLevel: number
	rarity: RewardRarity
	trigger: "press" | "hold" | "release" | "charge"
	resource: AbilityResource
	tags: readonly string[]
	weights: Partial<Record<RewardSource, number>>
	defaultUnlocked?: boolean
}

export const MOBILITY_ABILITIES: readonly AbilityDefinition[] = [
	{
		id: "thrusterOverdrive" as MobilityAbilityId,
		slot: "mobility",
		name: "THRUSTER OVERDRIVE",
		description: "Hold the mobility control to overclock the ship's thrusters.",
		icon: "overclock_thrusters_upg1",
		minimumHubLevel: 1,
		rarity: RewardRarity.Uncommon,
		trigger: "hold",
		resource: { type: "none" },
		tags: ["movement", "speed", "thruster"],
		weights: { crate: 90, enemy: 18, boss: 70 },
	},
	{
		id: "phaseJump" as MobilityAbilityId,
		slot: "mobility",
		name: "PHASE JUMP",
		description: "Phase rapidly through space and avoid incoming damage.",
		icon: "space_jump_upg1",
		minimumHubLevel: 2,
		rarity: RewardRarity.Rare,
		trigger: "press",
		resource: { type: "charges", count: 1, recharge: 2.5 },
		tags: ["movement", "evasive", "phase"],
		weights: { crate: 70, enemy: 12, boss: 60 },
	},
]

export const ULTIMATE_ABILITIES: readonly AbilityDefinition[] = [
	{
		id: "phaseNova" as UltimateAbilityId,
		slot: "ultimate",
		name: "PHASE NOVA",
		description: "Release a fully charged phase wave that devastates nearby hostiles.",
		icon: "singularity_payload_upg1",
		minimumHubLevel: 4,
		rarity: RewardRarity.Legendary,
		trigger: "press",
		resource: { type: "meter", required: 100 },
		tags: ["ultimate", "phase", "area"],
		weights: { crate: 24, enemy: 4, boss: 36 },
	},
]

const PRIMARY_ABILITIES: readonly AbilityDefinition[] = WEAPONS.map((weapon) => ({
	id: weapon.id,
	slot: "primary" as const,
	name: weapon.name,
	description: weapon.description,
	icon: weapon.icon,
	minimumHubLevel: weapon.minimumHubLevel,
	rarity: weapon.id === "standardBlaster"
		? RewardRarity.Common
		: RewardRarity.Rare,
	trigger: getWeaponTriggerModifier(weapon).mode,
	resource: { type: "cooldown" as const, duration: weapon.fireCooldown },
	tags: ["weapon", "primary"],
	weights: weapon.id === "standardBlaster"
		? {}
		: { crate: 120, enemy: 14, boss: 75 },
	defaultUnlocked: weapon.id === "standardBlaster",
}))

const SECONDARY_ABILITIES: readonly AbilityDefinition[] = ACTIVE_MODULES.map((module) => ({
	id: module.id,
	slot: "secondary" as const,
	name: module.name,
	description: module.description,
	icon: module.icon,
	minimumHubLevel: module.minimumHubLevel,
	rarity: module.rarity,
	trigger: "press" as const,
	resource: { type: "cooldown" as const, duration: module.cooldown },
	tags: ["module", "secondary"],
	weights: {
		crate: module.crateWeight,
		enemy: Math.max(6, Math.round(module.crateWeight * 0.12)),
		boss: Math.max(35, Math.round(module.crateWeight * 0.55)),
	},
}))

export const ABILITIES: readonly AbilityDefinition[] = [
	...PRIMARY_ABILITIES,
	...SECONDARY_ABILITIES,
	...MOBILITY_ABILITIES,
	...ULTIMATE_ABILITIES,
]

export function getAbilityDefinition(id: AbilityId) {
	return ABILITIES.find((ability) => ability.id === id)
}

export function getAbilitiesForSlot(slot: AbilitySlot) {
	return ABILITIES.filter((ability) => ability.slot === slot)
}

export function getAbilityDiscoveryKey(ability: Pick<AbilityDefinition, "id" | "slot">) {
	switch (ability.slot) {
		case "primary":
			return `weapon:${ability.id}`
		case "secondary":
			return `active:${ability.id}`
		case "mobility":
			return `mobility:${ability.id}`
		case "ultimate":
			return `ultimate:${ability.id}`
	}
}

export function isAbilityDiscovered(ability: AbilityDefinition) {
	return ability.defaultUnlocked === true ||
		isBlueprintDiscovered(getAbilityDiscoveryKey(ability))
}

export function discoverAbility(id: AbilityId) {
	const ability = getAbilityDefinition(id)
	if (!ability) return false
	if (ability.slot === "primary") unlockWeapon(ability.id as WeaponId, false)
	if (ability.defaultUnlocked) return false
	return discoverBlueprint(getAbilityDiscoveryKey(ability))
}

export function isAbilityId(id: string): id is AbilityId {
	return ABILITIES.some((ability) => ability.id === id)
}

export function isAbilityIdForSlot(
	id: string | undefined,
	slot: AbilitySlot
): id is AbilityId {
	return !!id && ABILITIES.some(
		(ability) => ability.id === id && ability.slot === slot
	)
}

export function migrateLegacyAbilityDiscoveries(
	ownedWeaponIds: readonly string[],
	legacyUpgradeLoadout: Readonly<Record<string, number | undefined>>
) {
	for (const weaponId of ownedWeaponIds) {
		const ability = ABILITIES.find(
			(candidate) => candidate.slot === "primary" && candidate.id === weaponId
		)
		if (ability && !ability.defaultUnlocked) {
			discoverBlueprint(getAbilityDiscoveryKey(ability))
		}
	}
	if (legacyUpgradeLoadout.sprint !== undefined) {
		discoverAbility("thrusterOverdrive")
	}
	if (legacyUpgradeLoadout.spaceJump !== undefined) {
		discoverAbility("phaseJump")
	}
}

export function getDefaultMobilityFromLegacyLoadout(
	legacyUpgradeLoadout: Readonly<Record<string, number | undefined>>
): MobilityAbilityId | undefined {
	if (legacyUpgradeLoadout.spaceJump !== undefined) return "phaseJump"
	if (legacyUpgradeLoadout.sprint !== undefined) return "thrusterOverdrive"
	return undefined
}

export function getActiveModuleId(id: AbilityId): ActiveModuleId | undefined {
	return ACTIVE_MODULES.some((module) => module.id === id)
		? id as ActiveModuleId
		: undefined
}
