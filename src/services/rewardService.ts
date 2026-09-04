import { Vec2 } from "kaplay"
import { k } from "../main"
import { grantRerollTokens, loadPlayer, player } from "../player"
import { tags } from "../tags"
import {
	PowerupKey,
	powerupReq,
	powerups,
	powerupsSprites,
} from "../powerups"
import {
	getEffectiveUpgradeLevel,
	getNextRunUpgradeLevel,
	grantRunUpgrade,
	isToolKey,
	isPermanentUpgradeKey,
	addLvl,
	describeUpgradeRequirements,
	getUpgradeRequirementText,
} from "../upg"
import {
	RewardKind,
	RewardProgression,
	RewardRarity,
	RewardSource,
} from "../types/rewardTypes"
import { UpgradeEffect, UpgradeDefinition } from "../types/upgradeTypes"
import {
	getAllUpgradeDefinitions,
} from "../upgrades/upgradeRegistry"
import {
	getWeaponTriggerModifier,
	type WeaponDefinition,
	type WeaponId,
	WEAPONS,
} from "./weaponService"
import {
	ACTIVE_MODULES,
	isRocketPodEquipped,
	type ActiveModuleDefinition,
	type ActiveModuleId,
} from "./activeModuleService"
import {
	clampRewardRarity,
	getRarityRank,
	REWARD_RARITY_ORDER,
	scaleUpgradeEffects,
} from "./rewardQualityService"
import { getHubChestLuck, getHubLevel } from "./hubProgressService"
import {
	ABILITIES,
	discoverAbility,
	getAbilityDefinition,
	isAbilityDiscovered,
	type AbilityDefinition,
} from "./abilityRegistry"
import type {
	AbilityId,
	AbilitySlot,
} from "./abilityLoadoutService"

export { RewardRarity }
export type { RewardKind, RewardSource }

export const REWARD_RARITY_COLORS: Readonly<
	Record<RewardRarity, readonly [number, number, number]>
> = {
	[RewardRarity.Common]: [255, 255, 255],
	[RewardRarity.Uncommon]: [80, 220, 120],
	[RewardRarity.Rare]: [70, 150, 255],
	[RewardRarity.Epic]: [190, 90, 255],
	[RewardRarity.Legendary]: [255, 185, 45],
}

export interface RewardDefinition {
	id: string
	kind: RewardKind
	name: string
	description: string
	stats: Readonly<Record<string, number | string>>
	sprite: string
	rarity: RewardRarity
	progression: RewardProgression
	allowedSources: readonly RewardSource[]
	weights: Partial<Record<RewardSource, number>>
	minimumHubLevel?: number
	powerupKey?: PowerupKey
	upgradeKey?: string
	weaponId?: WeaponId
	activeModuleId?: ActiveModuleId
	abilityId?: AbilityId
	abilitySlot?: AbilitySlot
	levelIndex?: number
	canReceive?: () => boolean
}

export interface Reward {
	id: string
	kind: RewardKind
	name: string
	description: string
	stats: Readonly<Record<string, number | string>>
	sprite: string
	rarity: RewardRarity
	progression: RewardProgression
	quantity?: number
	powerupKey?: PowerupKey
	upgradeKey?: string
	weaponId?: WeaponId
	activeModuleId?: ActiveModuleId
	abilityId?: AbilityId
	abilitySlot?: AbilitySlot
	levelIndex?: number
	newDiscovery?: boolean
}

export interface CrateRewardResult {
	rewards: Reward[]
	discoveries: Reward[]
	choices: Reward[]
	failures: number
	quality: number
}

interface RarityWeights {
	common: number
	uncommon: number
	rare: number
	epic: number
	legendary: number
}

const CRATE_RARITY_WEIGHTS: RarityWeights[] = [
	{ common: 600, uncommon: 300, rare: 80, epic: 20, legendary: 0 },
	{ common: 450, uncommon: 350, rare: 150, epic: 45, legendary: 5 },
	{ common: 300, uncommon: 350, rare: 250, epic: 85, legendary: 15 },
	{ common: 150, uncommon: 300, rare: 350, epic: 160, legendary: 40 },
]

const ENEMY_EMPTY_WEIGHT = 45000

const STANDARD_DRONE_REQUIRED_UPGRADES = new Set([
	"followerBlasterDmg",
	"followerMissiles",
	"followerProjectileLink",
	"followerInterceptorProtocol",
	"followerGunship",
	"followerMedic",
	"followerSalvager",
	"sacrificialProtocol",
])

const powerupRewardRegistry: Record<PowerupKey, RewardDefinition> = {
	addFollower: {
		id: "addFollower",
		kind: "powerup",
		powerupKey: "addFollower",
		name: "COMBAT DRONE",
		description: "Spawns a follower drone to fight by your side",
		stats: { followers: "+1" },
		sprite: powerupsSprites.addFollower,
		rarity: RewardRarity.Epic,
		progression: scalingProgression(RewardRarity.Epic, "stack"),
		allowedSources: ["crate", "boss"],
		weights: { crate: 350, boss: 400 },
		minimumHubLevel: 2,
	},
	addPlayerMaxHealth: {
		id: "addPlayerMaxHealth",
		kind: "powerup",
		powerupKey: "addPlayerMaxHealth",
		name: "HULL REINFORCEMENT",
		description: "Increases your maximum health by 1",
		stats: { maxHealth: "+1", healing: "+1" },
		sprite: powerupsSprites.addPlayerMaxHealth,
		rarity: RewardRarity.Rare,
		progression: scalingProgression(RewardRarity.Rare, "stack"),
		allowedSources: ["crate", "boss"],
		weights: { crate: 200, boss: 300 },
	},
	addExtraRockets: {
		id: "addExtraRockets",
		kind: "powerup",
		powerupKey: "addExtraRockets",
		name: "MISSILE CACHE",
		description: "Adds 1 extra rocket to your arsenal",
		stats: { extraRockets: "+1" },
		sprite: powerupsSprites.addExtraRockets,
		rarity: RewardRarity.Uncommon,
		progression: scalingProgression(RewardRarity.Uncommon, "stack"),
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 120, enemy: 120, boss: 180 },
		canReceive: powerupReq.addExtraRockets,
	},
	addSpaceDebree: {
		id: "addSpaceDebree",
		kind: "powerup",
		powerupKey: "addSpaceDebree",
		name: "SHRAPNEL PAYLOAD",
		description: "Adds 2 extra shrapnel to your missiles",
		stats: { rocketShards: "+2" },
		sprite: powerupsSprites.addSpaceDebree,
		rarity: RewardRarity.Common,
		progression: scalingProgression(RewardRarity.Common, "stack"),
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 110, enemy: 110, boss: 160 },
		canReceive: powerupReq.addSpaceDebree,
	},
	addPrimaryRocketChance: {
		id: "addPrimaryRocketChance",
		kind: "powerup",
		powerupKey: "addPrimaryRocketChance",
		name: "ROCKET COUPLER",
		description: "Primary fire has a 10% chance to launch a homing rocket whose damage inherits from your primary weapon",
		stats: { procChance: "+10%", damage: "Primary weapon" },
		sprite: powerupsSprites.addPrimaryRocketChance,
		rarity: RewardRarity.Rare,
		progression: scalingProgression(RewardRarity.Rare, "stack"),
		allowedSources: ["crate", "enemy", "boss"],
		weights: { crate: 90, enemy: 55, boss: 130 },
		minimumHubLevel: 2,
	},
	slowdownTime: {
		id: "slowdownTime",
		kind: "powerup",
		powerupKey: "slowdownTime",
		name: "TIME DILATOR",
		description: "Slows down time for 6 seconds",
		stats: { timescale: 0.3, duration: "6s" },
		sprite: powerupsSprites.slowdownTime,
		rarity: RewardRarity.Uncommon,
		progression: fixedProgression(RewardRarity.Uncommon, "once"),
		allowedSources: ["enemy"],
		weights: { enemy: 130 },
	},
}

const itemRewardRegistry: Record<string, RewardDefinition> = {
	rerollToken: {
		id: "rerollToken",
		kind: "item",
		name: "REROLL TOKEN",
		description: "Spend at an opened chest to replace every offered reward",
		stats: { rerollTokens: "+1" },
		sprite: "reroll_token",
		rarity: RewardRarity.Uncommon,
		progression: scalingProgression(RewardRarity.Uncommon, "stack"),
		allowedSources: ["enemy", "boss"],
		weights: { enemy: 60, boss: 120 },
	},
}

export function getRewardDefinitions(
	source?: RewardSource
): RewardDefinition[] {
	return getAllRewardDefinitions(source).filter(canReceiveReward)
}

export function getAllRewardDefinitions(
	source?: RewardSource
): RewardDefinition[] {
	const powerupRewards = Object.values(powerupRewardRegistry)
	const itemRewards = Object.values(itemRewardRegistry)
	const weaponRewards = WEAPONS.map(buildWeaponReward)
	const activeModuleRewards = ACTIVE_MODULES.map(buildActiveModuleReward)
	const mobilityRewards = ABILITIES
		.filter((ability) => ability.slot === "mobility")
		.map(buildAbilityReward)
	const ultimateRewards = ABILITIES
		.filter((ability) => ability.slot === "ultimate")
		.map(buildAbilityReward)
	const upgradeRewards = getAllUpgradeDefinitions()
		.map(buildCurrentUpgradeReward)
		.filter((reward): reward is RewardDefinition => reward !== undefined)

	return [
		...powerupRewards,
		...itemRewards,
		...weaponRewards,
		...activeModuleRewards,
		...mobilityRewards,
		...ultimateRewards,
		...upgradeRewards,
	].filter((definition) => {
		return !source || definition.allowedSources.includes(source)
	})
}

export function canReceiveReward(definition: RewardDefinition): boolean {
	if (getHubLevel() < getRewardMinimumHubLevel(definition)) return false
	if (definition.abilityId) {
		const ability = getAbilityDefinition(definition.abilityId)
		if (!ability || isAbilityDiscovered(ability)) return false
	}
	if (isRocketDependentReward(definition) && !isRocketPodEquipped()) return false
	return definition.canReceive ? definition.canReceive() : true
}

export function getRewardMinimumHubLevel(definition: RewardDefinition) {
	return Math.max(1, Math.round(definition.minimumHubLevel ?? 1))
}

export function getRewardLockReason(
	definition: RewardDefinition
): string | undefined {
	if (canReceiveReward(definition)) return undefined
	const minimumHubLevel = getRewardMinimumHubLevel(definition)
	if (getHubLevel() < minimumHubLevel) {
		return `Requires Hub Level ${minimumHubLevel}`
	}
	if (definition.abilityId) return "Already discovered"
	if (
		definition.upgradeKey &&
		requiresStandardDrone(definition.upgradeKey) &&
		!hasStandardDrone()
	) {
		return "Requires a standard combat drone in the swarm"
	}
	if (definition.upgradeKey && isToolKey(definition.upgradeKey)) {
		const requirement = getUpgradeRequirementText(definition.upgradeKey)
		if (requirement) return `Requires ${requirement}`
		if (getEffectiveUpgradeLevel(definition.upgradeKey) !== undefined) {
			return "Maximum level reached"
		}
	}
	return "Requirements not met"
}

export function getRewardDefinition(id: string): RewardDefinition | undefined {
	const normalizedId = id.toLowerCase()
	const powerupKey = Object.keys(powerupRewardRegistry).find(
		(key) => key.toLowerCase() === normalizedId
	) as PowerupKey | undefined
	const powerup = powerupKey ? powerupRewardRegistry[powerupKey] : undefined
	if (powerup) return powerup
	const item = Object.values(itemRewardRegistry).find(
		(candidate) => candidate.id.toLowerCase() === normalizedId
	)
	if (item) return item
	const activeModule = ACTIVE_MODULES.find(
		(candidate) => `active:${candidate.id}`.toLowerCase() === normalizedId
	)
	if (activeModule) return buildActiveModuleReward(activeModule)

	const weapon = WEAPONS.find(
		(candidate) => `weapon:${candidate.id}`.toLowerCase() === normalizedId
	)
	if (weapon) return buildWeaponReward(weapon)

	const ability = ABILITIES.find(
		(candidate) =>
			candidate.slot !== "primary" &&
			candidate.slot !== "secondary" &&
			`${candidate.slot}:${candidate.id}`.toLowerCase() === normalizedId
	)
	if (ability) return buildAbilityReward(ability)

	const currentUpgrade = getAllUpgradeDefinitions().find(
		(definition) => definition.toolKey.toLowerCase() === normalizedId
	)
	if (currentUpgrade) return buildCurrentUpgradeReward(currentUpgrade)

	const match = /^(?:upgrade:)?([^:]+):(\d+)$/.exec(id)
	if (!match) return undefined
	const definition = getAllUpgradeDefinitions().find(
		(candidate) => candidate.toolKey.toLowerCase() === match[1].toLowerCase()
	)
	if (!definition) return undefined
	return buildUpgradeReward(definition, Number(match[2]) - 1)
}

export function createReward(
	id: string,
	rarity?: RewardRarity
): Reward | undefined {
	return toReward(getRewardDefinition(id), rarity)
}

export function createDirectUpgradeReward(
	toolKey: string,
	levelIndex: number
): Reward | undefined {
	const definition = getAllUpgradeDefinitions().find(
		(candidate) => candidate.toolKey === toolKey
	)
	if (!definition) return undefined
	return toReward(buildUpgradeReward(definition, levelIndex, true))
}

export function rollCrateReward(successfulHits: number): Reward | undefined {
	return rollCrateRewardForQuality(successfulHits, [])
}

export function rollMapEventReward(successfulHits: number): Reward | undefined {
	return rollCrateRewardForQuality(successfulHits, [], false)
}

export function rollCrateRewardChoices(
	successfulHits: number,
	failedAttempts: number,
	excludedRewardIds: readonly string[] = []
): CrateRewardResult {
	const missedZones = Math.max(0, 3 - Math.floor(successfulHits))
	const failures = Math.max(0, Math.floor(failedAttempts)) + missedZones
	const quality = k.clamp(3 - failures, 0, 3)
	const choiceCount = failures === 0 ? 3 : failures <= 2 ? 2 : 1
	const rewards: Reward[] = []

	for (let index = 0; index < choiceCount; index++) {
		const selectedIds = rewards.map((current) => current.id)
		const abilityExclusions = rewards.some(isAbilityReward)
			? getAbilityRewardDefinitionIds()
			: []
		const requiredExclusions = [...selectedIds, ...abilityExclusions]
		let reward = rollCrateRewardForQuality(
			quality,
			[...excludedRewardIds, ...requiredExclusions]
		)
		if (!reward && excludedRewardIds.length > 0) {
			reward = rollCrateRewardForQuality(quality, requiredExclusions)
		}
		if (!reward) break
		rewards.push(reward)
	}

	return createCrateRewardResult(rewards, failures, quality)
}

export function rollWeaponChestRewardChoices(
	successfulHits: number,
	failedAttempts: number,
	excludedRewardIds: readonly string[] = []
): CrateRewardResult {
	const missedZones = Math.max(0, 3 - Math.floor(successfulHits))
	const failures = Math.max(0, Math.floor(failedAttempts)) + missedZones
	const quality = k.clamp(3 - failures, 0, 3)
	const rewards: Reward[] = []
	const available = getRewardDefinitions("crate").filter(
		(definition) => definition.abilityId !== undefined
	)

	for (let index = 0; index < 1; index++) {
		let candidates = available.filter(
			(definition) =>
				!excludedRewardIds.includes(definition.id) &&
				!rewards.some((reward) => reward.id === definition.id)
		)
		if (candidates.length === 0 && excludedRewardIds.length > 0) {
			candidates = available.filter(
				(definition) =>
					!rewards.some((reward) => reward.id === definition.id)
			)
		}
		const targetRarity = rollCrateRarity(quality)
		const matching = candidates.filter((definition) =>
			canResolveAtRarity(definition, targetRarity)
		)
		const selectionPool = matching.length > 0
			? matching
			: getNearestRarityPool(candidates, targetRarity)
		const selected = pickWeighted(selectionPool, "crate")
		const reward = toReward(selected)
		if (!reward) break
		rewards.push(reward)
	}

	return createCrateRewardResult(rewards, failures, quality)
}

function createCrateRewardResult(
	rewards: Reward[],
	failures: number,
	quality: number
): CrateRewardResult {
	return {
		rewards,
		discoveries: rewards.filter(isAbilityReward),
		choices: rewards.filter((reward) => !isAbilityReward(reward)),
		failures,
		quality,
	}
}

export function isAbilityReward(
	reward: Pick<Reward, "abilityId" | "abilitySlot">
) {
	return reward.abilityId !== undefined && reward.abilitySlot !== undefined
}

export function getAbilityRewardDefinitionIds() {
	return ABILITIES
		.filter((ability) => !ability.defaultUnlocked)
		.map((ability) => `${ability.slot === "primary"
			? "weapon"
			: ability.slot === "secondary"
				? "active"
				: ability.slot}:${ability.id}`)
}

export function rollDropReward(
	source: "enemy" | "boss",
	chanceMultiplier: number = 1
): Reward | undefined {
	const available = getRewardDefinitions(source)
	if (available.length === 0) return undefined

	const multiplier = Number.isFinite(chanceMultiplier)
		? Math.max(0, chanceMultiplier)
		: 1
	const rewardWeight = available.reduce(
		(total, reward) => total + (reward.weights[source] ?? 0) * multiplier,
		0
	)
	const emptyWeight = source === "enemy" ? ENEMY_EMPTY_WEIGHT : 0
	const roll = k.rand(0, rewardWeight + emptyWeight)
	if (roll < emptyWeight) return undefined

	const selected = pickWeighted(available, source, multiplier)
	return toReward(
		selected,
		selected ? rollDropRarity(selected, source) : undefined
	)
}

function rollDropRarity(
	definition: RewardDefinition,
	source: "enemy" | "boss"
) {
	const behavior = definition.progression.rarity
	if (behavior.mode === "fixed") return behavior.value
	const minRank = getRarityRank(behavior.min)
	const maxRank = getRarityRank(behavior.max)
	const upgradeChance = source === "boss" ? 0.55 : 0.18
	let rank = minRank
	while (rank < maxRank && k.rand() < upgradeChance) rank++
	return REWARD_RARITY_ORDER[rank]
}

export function applyReward(reward: Reward, pos: Vec2): boolean {
	if (reward.abilityId && reward.abilitySlot) {
		reward.newDiscovery = discoverAbility(reward.abilityId)
		return true
	}

	if (reward.kind === "item" && reward.id === "rerollToken") {
		grantRerollTokens(reward.quantity ?? 1)
		return true
	}

	if (reward.kind === "powerup" && reward.powerupKey) {
		for (let index = 0; index < (reward.quantity ?? 1); index++) {
			powerups[reward.powerupKey](pos)
		}
		return true
	}

	if (reward.kind === "upgrade" && reward.upgradeKey !== undefined) {
		if (!isToolKey(reward.upgradeKey)) return false
		if (
			requiresStandardDrone(reward.upgradeKey) &&
			!hasStandardDrone()
		) return false
		if (getNextRunUpgradeLevel(reward.upgradeKey) !== reward.levelIndex) {
			return false
		}
		if (isPermanentUpgradeKey(reward.upgradeKey)) {
			addLvl(reward.upgradeKey, reward.rarity)
			loadPlayer()
			return true
		}
		const grantedLevel = grantRunUpgrade(
			reward.upgradeKey,
			reward.rarity
		)
		if (grantedLevel === undefined) return false
		loadPlayer()
		return true
	}

	return false
}

function buildActiveModuleReward(
	module: ActiveModuleDefinition
): RewardDefinition {
	return {
		id: `active:${module.id}`,
		kind: "activeModule",
		activeModuleId: module.id,
		abilityId: module.id,
		abilitySlot: "secondary",
		name: module.name,
		description: `${module.description} Unlocks for your next run.`,
		stats: {
			SLOT: "SECONDARY",
			...module.stats,
		},
		sprite: module.icon,
		rarity: module.rarity,
		progression: fixedProgression(module.rarity, "once", "permanent"),
		allowedSources: ["crate", "enemy", "boss"],
		weights: {
			crate: module.crateWeight,
			enemy: Math.max(6, Math.round(module.crateWeight * 0.12)),
			boss: Math.max(35, Math.round(module.crateWeight * 0.55)),
		},
		minimumHubLevel: module.minimumHubLevel,
	}
}

function isRocketDependentReward(definition: RewardDefinition) {
	if (definition.powerupKey === "addExtraRockets") return true
	if (definition.powerupKey === "addSpaceDebree") return true
	return definition.upgradeKey === "nrOfRockets" ||
		definition.upgradeKey === "rocketShards"
}

function buildWeaponReward(weapon: WeaponDefinition): RewardDefinition {
	const triggerModifier = getWeaponTriggerModifier(weapon)
	const fireRate = triggerModifier.usesCooldown
		? `${(1 / weapon.fireCooldown).toFixed(1)}/S`
		: "PER CLICK"
	const preset = weapon.charge
		? "CHARGED SHOT"
		: (weapon.pattern?.projectileCount ?? 1) > 1
			? `${weapon.pattern?.projectileCount} PROJECTILES`
			: (weapon.pattern?.burstCount ?? 1) > 1
				? `${weapon.pattern?.burstCount}-ROUND BURST`
				: weapon.splash
					? `SPLASH ${weapon.splash.radius}`
					: weapon.piercing
						? `PIERCE +${weapon.piercing.maxPierces}`
						: weapon.chain
							? `CHAIN +${weapon.chain.maxChains}`
							: "NONE"

	return {
		id: `weapon:${weapon.id}`,
		kind: "weapon",
		weaponId: weapon.id,
		abilityId: weapon.id,
		abilitySlot: "primary",
		name: weapon.name,
		description: `${weapon.description} Unlocks for your next run.`,
		stats: {
			SLOT: "PRIMARY",
			DAMAGE: formatMultiplier(weapon.damageMultiplier),
			"FIRE RATE": fireRate,
			PRESET: preset,
		},
		sprite: weapon.icon,
		rarity: weapon.id === "standardBlaster"
			? RewardRarity.Common
			: RewardRarity.Rare,
		progression: fixedProgression(
			weapon.id === "standardBlaster"
				? RewardRarity.Common
				: RewardRarity.Rare,
			"once",
			"permanent"
		),
		allowedSources: ["crate", "enemy", "boss"],
		weights: weapon.id === "standardBlaster"
			? {}
			: { crate: 120, enemy: 14, boss: 75 },
		minimumHubLevel: weapon.minimumHubLevel,
	}
}

function buildAbilityReward(
	ability: AbilityDefinition
): RewardDefinition {
	return {
		id: `${ability.slot}:${ability.id}`,
		kind: ability.slot === "ultimate" ? "ultimate" : "mobility",
		abilityId: ability.id,
		abilitySlot: ability.slot,
		name: ability.name,
		description: `${ability.description} Unlocks for your next run.`,
		stats: {
			SLOT: ability.slot.toUpperCase(),
			RESOURCE: ability.resource.type.toUpperCase(),
		},
		sprite: ability.icon,
		rarity: ability.rarity,
		progression: fixedProgression(ability.rarity, "once", "permanent"),
		allowedSources: ["crate", "enemy", "boss"],
		weights: ability.weights,
		minimumHubLevel: ability.minimumHubLevel,
	}
}

function buildCurrentUpgradeReward(
	definition: UpgradeDefinition
): RewardDefinition | undefined {
	if (!definition.reward || !isToolKey(definition.toolKey)) return undefined
	const currentLevel = getEffectiveUpgradeLevel(definition.toolKey) ?? -1
	const levelIndex = Math.min(currentLevel + 1, definition.levels.length - 1)
	if (levelIndex < 0) return undefined
	return buildUpgradeReward(definition, levelIndex)
}

function buildUpgradeReward(
	definition: UpgradeDefinition,
	levelIndex: number,
	allowWithoutRewardPolicy: boolean = false
): RewardDefinition | undefined {
	const policy = definition.reward ?? (allowWithoutRewardPolicy
		? {
			rarity: RewardRarity.Common,
			allowedSources: [],
			weights: {},
		}
		: undefined)
	const level = definition.levels[levelIndex]
	const toolKey = definition.toolKey
	if (!policy || !level || !isToolKey(toolKey)) return undefined
	const requirementText = describeUpgradeRequirements(definition)
	const scalable = level.effects.modifiers?.length
		? true
		: false
	const permanent = isPermanentUpgradeKey(toolKey)
	const repeatability = definition.levels.length > 1 ? "stack" : "once"
	const rarity = permanent ? RewardRarity.Legendary : policy.rarity

	return {
		id: `upgrade:${toolKey}:${levelIndex + 1}`,
		kind: "upgrade",
		upgradeKey: toolKey,
		levelIndex,
		name: permanent && repeatability === "once"
			? definition.toolName.toUpperCase()
			: `${definition.toolName.toUpperCase()} ${level.name.toUpperCase()}`,
		description: requirementText
			? `${level.desc}\nREQUIRES: ${requirementText}`
			: level.desc,
		stats: formatUpgradeStats(level.effects),
		sprite: level.sprite,
		rarity,
		progression: permanent
			? fixedProgression(RewardRarity.Legendary, repeatability, "permanent")
			: scalable
			? scalingProgression(
				rarity,
				repeatability,
				"run"
			)
			: fixedProgression(
				rarity,
				repeatability,
				"run"
			),
		allowedSources: permanent ? ["crate"] : policy.allowedSources,
		weights: permanent
			? { crate: policy.weights.crate ?? 1 }
			: policy.weights,
		minimumHubLevel: policy.minimumHubLevel,
		canReceive: () =>
			getNextRunUpgradeLevel(toolKey) === levelIndex &&
			(!requiresStandardDrone(toolKey) || hasStandardDrone()),
	}
}

function requiresStandardDrone(toolKey: string) {
	return STANDARD_DRONE_REQUIRED_UPGRADES.has(toolKey)
}

function hasStandardDrone() {
	return k.get(tags.follower).some((follower) => {
		return follower.exists() && follower.droneType === "combat"
	})
}

function formatUpgradeStats(
	effects: UpgradeEffect
): Readonly<Record<string, number | string>> {
	const stats: Record<string, number | string> = {}
	for (const modifier of effects.modifiers ?? []) {
		if (modifier.stat === "critChance") {
			stats[modifier.stat] = `${modifier.value}%`
			continue
		}
		if (modifier.stat === "critMultiplier") {
			stats[modifier.stat] = `${modifier.value}x`
			continue
		}
		const prefix = modifier.type === "multiply" ? "x" : modifier.type === "additive" ? "+" : "="
		stats[modifier.stat] = `${prefix}${modifier.value}`
	}
	if (effects.unlocks?.length) {
		stats.unlock = effects.unlocks.map((unlock) => unlock.unlockId).join(",")
	}
	if (effects.abilities?.length) {
		stats.ability = effects.abilities.map((ability) => ability.abilityId).join(",")
	}
	return stats
}

function formatMultiplier(value: number) {
	return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`
}

function rollCrateRarity(successfulHits: number): RewardRarity {
	const hitIndex = k.clamp(Math.floor(successfulHits), 0, 3)
	const baseWeights = CRATE_RARITY_WEIGHTS[hitIndex]
	const luck = getHubChestLuck()
	const weights = shiftRarityWeights(baseWeights, luck)
	const total =
		weights.common +
		weights.uncommon +
		weights.rare +
		weights.epic +
		weights.legendary
	const roll = k.rand(0, total)

	if (roll < weights.common) return RewardRarity.Common
	if (roll < weights.common + weights.uncommon) return RewardRarity.Uncommon
	if (roll < weights.common + weights.uncommon + weights.rare) {
		return RewardRarity.Rare
	}
	if (
		roll <
		weights.common + weights.uncommon + weights.rare + weights.epic
	) {
		return RewardRarity.Epic
	}
	return RewardRarity.Legendary
}

function shiftRarityWeights(weights: RarityWeights, luck: number): RarityWeights {
	const shift = Math.min(1, Math.max(0, luck))
	const values = [
		weights.common,
		weights.uncommon,
		weights.rare,
		weights.epic,
		weights.legendary,
	]
	const adjusted = [...values]
	for (let index = 0; index < values.length - 1; index++) {
		const moved = values[index] * shift
		adjusted[index] -= moved
		adjusted[index + 1] += moved
	}
	return {
		common: adjusted[0],
		uncommon: adjusted[1],
		rare: adjusted[2],
		epic: adjusted[3],
		legendary: adjusted[4],
	}
}

function rollCrateRewardForQuality(
	quality: number,
	excludedIds: readonly string[],
	allowPermanent: boolean = true
): Reward | undefined {
	const rarity = rollCrateRarity(quality)
	const available = getRewardDefinitions("crate").filter(
		(reward) =>
			!excludedIds.includes(reward.id) &&
			(allowPermanent || reward.progression.persistence !== "permanent")
	)
	const matching = available.filter((reward) =>
		canResolveAtRarity(reward, rarity)
	)
	const pool = matching.length > 0
		? matching
		: getNearestRarityPool(available, rarity)
	const selected = pickWeighted(pool, "crate")
	return toReward(
		selected,
		selected && canResolveAtRarity(selected, rarity)
			? rarity
			: selected?.rarity
	)
}

function getNearestRarityPool(
	rewards: RewardDefinition[],
	target: RewardRarity
): RewardDefinition[] {
	const order = [
		RewardRarity.Common,
		RewardRarity.Uncommon,
		RewardRarity.Rare,
		RewardRarity.Epic,
		RewardRarity.Legendary,
	]
	const targetIndex = order.indexOf(target)
	for (let distance = 1; distance < order.length; distance++) {
		const lower = order[targetIndex - distance]
		const higher = order[targetIndex + distance]
		const nearby = rewards.filter(
			(reward) => reward.rarity === lower || reward.rarity === higher
		)
		if (nearby.length > 0) return nearby
	}
	return rewards
}

function pickWeighted(
	rewards: RewardDefinition[],
	source: RewardSource,
	multiplier: number = 1
): RewardDefinition | undefined {
	if (rewards.length === 0) return undefined
	const total = rewards.reduce(
		(sum, reward) => sum + (reward.weights[source] ?? 0) * multiplier,
		0
	)
	if (total <= 0) return rewards[Math.floor(k.rand(0, rewards.length))]

	let roll = k.rand(0, total)
	for (const reward of rewards) {
		roll -= (reward.weights[source] ?? 0) * multiplier
		if (roll <= 0) return reward
	}
	return rewards[rewards.length - 1]
}

function toReward(
	definition: RewardDefinition | undefined,
	rolledRarity?: RewardRarity
): Reward | undefined {
	if (!definition) return undefined
	const rarity = resolveRewardRarity(definition, rolledRarity)
	const qualitySteps = definition.progression.rarity.mode === "scaling"
		? Math.max(0, getRarityRank(rarity) - getRarityRank(definition.rarity))
		: 0
	const quantity = definition.kind === "powerup" || definition.kind === "item"
		? 1 + qualitySteps
		: undefined
	const upgradeDefinition = definition.upgradeKey
		? getAllUpgradeDefinitions().find(
			(candidate) => candidate.toolKey === definition.upgradeKey
		)
		: undefined
	const level = upgradeDefinition && definition.levelIndex !== undefined
		? upgradeDefinition.levels[definition.levelIndex]
		: undefined
	const scaledEffects = level
		? scaleUpgradeEffects(level.effects, definition.rarity, rarity)
		: undefined
	const scaledStats = scaledEffects
		? formatUpgradeStats(scaledEffects)
		: scaleQuantityStats(definition.stats, quantity)
	const description = level && scaledEffects
		? formatScaledDescription(level.desc, level.effects, scaledEffects)
		: quantity && quantity > 1
			? `${definition.description}\nRARITY BONUS: APPLIES ${quantity} TIMES`
			: definition.description
	return {
		id: definition.id,
		kind: definition.kind,
		name: definition.name,
		description,
		stats: scaledStats,
		sprite: definition.sprite,
		rarity,
		progression: definition.progression,
		quantity,
		powerupKey: definition.powerupKey,
		upgradeKey: definition.upgradeKey,
		weaponId: definition.weaponId,
		activeModuleId: definition.activeModuleId,
		abilityId: definition.abilityId,
		abilitySlot: definition.abilitySlot,
		levelIndex: definition.levelIndex,
	}
}

function resolveRewardRarity(
	definition: RewardDefinition,
	rolledRarity?: RewardRarity
) {
	const behavior = definition.progression.rarity
	if (behavior.mode === "fixed") return behavior.value
	return clampRewardRarity(
		rolledRarity ?? behavior.min,
		behavior.min,
		behavior.max
	)
}

function canResolveAtRarity(
	definition: RewardDefinition,
	rarity: RewardRarity
) {
	const behavior = definition.progression.rarity
	if (behavior.mode === "fixed") return behavior.value === rarity
	const rank = getRarityRank(rarity)
	return rank >= getRarityRank(behavior.min) &&
		rank <= getRarityRank(behavior.max)
}

function scalingProgression(
	min: RewardRarity,
	repeatability: RewardProgression["repeatability"],
	persistence: RewardProgression["persistence"] = "run"
): RewardProgression {
	return {
		persistence,
		repeatability,
		rarity: {
			mode: "scaling",
			min,
			max: RewardRarity.Legendary,
		},
	}
}

function fixedProgression(
	rarity: RewardRarity,
	repeatability: RewardProgression["repeatability"],
	persistence: RewardProgression["persistence"] = "run"
): RewardProgression {
	return {
		persistence,
		repeatability,
		rarity: { mode: "fixed", value: rarity },
	}
}

function scaleQuantityStats(
	stats: Readonly<Record<string, number | string>>,
	quantity: number | undefined
) {
	if (!quantity || quantity === 1) return stats
	return Object.fromEntries(Object.entries(stats).map(([key, value]) => {
		if (typeof value === "number") return [key, value * quantity]
		const match = /^\+(\d+(?:\.\d+)?)(%?)$/.exec(value)
		if (!match) return [key, value]
		return [key, `+${Number(match[1]) * quantity}${match[2]}`]
	}))
}

function formatScaledDescription(
	description: string,
	baseEffects: UpgradeEffect,
	scaledEffects: UpgradeEffect
) {
	let result = description
	for (let index = 0; index < (baseEffects.modifiers?.length ?? 0); index++) {
		const base = baseEffects.modifiers?.[index]?.value
		const scaled = scaledEffects.modifiers?.[index]?.value
		if (base === undefined || scaled === undefined || base === scaled) continue
		const percentPattern = `${Math.round(base * 100)}%`
		if (result.includes(percentPattern)) {
			result = result.replace(percentPattern, `${Math.round(scaled * 100)}%`)
			continue
		}
		result = result.replace(
			new RegExp(`\\b${escapeRegExp(String(base))}\\b`),
			String(scaled)
		)
	}
	return result
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
