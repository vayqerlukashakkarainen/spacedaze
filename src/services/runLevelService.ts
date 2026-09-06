import { RewardRarity } from "../types/rewardTypes"

export type RunLevelBonusId =
	| "weaponDamage"
	| "projectileSpeed"
	| "moveSpeed"
	| "criticalChance"
	| "collectionRange"
	| "blastRadius"

export interface RunLevelBonusDefinition {
	id: RunLevelBonusId
	name: string
	description: string
	stat: string
	baseValue: number
	percentage: boolean
	sprite: string
	rarity: RewardRarity
	maxStacks: number
}

export interface RunLevelSnapshot {
	active: boolean
	level: number
	xp: number
	requiredXp: number
	progress: number
	pendingSelections: number
	bonuses: Readonly<Record<RunLevelBonusId, number>>
	bonusPower: Readonly<Record<RunLevelBonusId, number>>
}

export interface RunLevelPlayerStats {
	blasterDmgMultiplier: number
	rocketDmgMultiplier: number
	followerBlasterDmgMultiplier: number
	blasterSpeedMultiplier: number
	speedMultiplier: number
	critChance: number
	debreeSeekDistanceMultiplier: number
	rocketSplashSizeMultiplier: number
}

export const RUN_LEVEL_BONUSES: readonly RunLevelBonusDefinition[] = [
	{
		id: "weaponDamage",
		name: "WEAPON CALIBRATION",
		description: "Increase damage dealt by primary weapons, missiles, and combat drones",
		stat: "ALL DAMAGE",
		baseValue: 0.08,
		percentage: true,
		sprite: "blaster_upg_dmg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "projectileSpeed",
		name: "BALLISTIC COILS",
		description: "Increase the velocity of primary weapon projectiles",
		stat: "PROJECTILE SPEED",
		baseValue: 0.1,
		percentage: true,
		sprite: "blaster_upg_speed1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "moveSpeed",
		name: "THRUSTER TUNING",
		description: "Increase ship movement speed for the rest of this expedition",
		stat: "MOVE SPEED",
		baseValue: 0.07,
		percentage: true,
		sprite: "faster_speed_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "criticalChance",
		name: "TARGETING CACHE",
		description: "Increase the critical-hit chance of compatible weapons",
		stat: "CRITICAL CHANCE",
		baseValue: 3,
		percentage: false,
		sprite: "parallel_blasters_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "collectionRange",
		name: "MAGNET ARRAY",
		description: "Increase the distance from which the ship attracts debris",
		stat: "COLLECTION RANGE",
		baseValue: 0.15,
		percentage: true,
		sprite: "debree_dist_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "blastRadius",
		name: "EXPANSION CHARGE",
		description: "Increase the blast radius of missiles and explosive effects",
		stat: "BLAST RADIUS",
		baseValue: 0.1,
		percentage: true,
		sprite: "rocket_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
]

const bonusStacks = createEmptyBonusStacks()
const bonusPower = createEmptyBonusStacks()
let active = false
let level = 1
let xp = 0
let pendingSelections = 0

export function beginRunLevelProgression() {
	active = true
	level = 1
	xp = 0
	pendingSelections = 0
	resetBonusStacks()
}

export function endRunLevelProgression() {
	active = false
	level = 1
	xp = 0
	pendingSelections = 0
	resetBonusStacks()
}

export function addRunLevelXp(amount: number) {
	if (!active || !Number.isFinite(amount) || amount <= 0) return 0
	const gained = Math.round(amount)
	xp += gained

	while (xp >= getRunLevelRequiredXp(level)) {
		xp -= getRunLevelRequiredXp(level)
		level++
		pendingSelections++
	}
	return gained
}

export function consumeRunLevelSelection() {
	if (pendingSelections <= 0) return false
	pendingSelections--
	return true
}

export function getRunLevelSnapshot(): RunLevelSnapshot {
	const requiredXp = getRunLevelRequiredXp(level)
	return {
		active,
		level,
		xp,
		requiredXp,
		progress: requiredXp > 0 ? xp / requiredXp : 0,
		pendingSelections,
		bonuses: { ...bonusStacks },
		bonusPower: { ...bonusPower },
	}
}

export function getRunLevelRequiredXp(currentLevel: number) {
	const normalizedLevel = Math.max(1, Math.floor(currentLevel))
	if (normalizedLevel <= 5) return 10 + normalizedLevel * 10
	return 75 + (normalizedLevel - 6) * 15
}

export function getAvailableRunLevelBonuses() {
	return RUN_LEVEL_BONUSES.filter(
		(bonus) => bonusStacks[bonus.id] < bonus.maxStacks
	)
}

export function grantRunLevelBonus(
	id: RunLevelBonusId,
	rarity: RewardRarity = RewardRarity.Common
) {
	const definition = RUN_LEVEL_BONUSES.find((bonus) => bonus.id === id)
	if (!definition || bonusStacks[id] >= definition.maxStacks) return false
	bonusStacks[id]++
	bonusPower[id] += getRunLevelRarityMultiplier(rarity)
	return true
}

export function rollRunLevelBonusRarity(random: () => number = Math.random) {
	const roll = random() * 100
	if (roll < 1) return RewardRarity.Legendary
	if (roll < 5) return RewardRarity.Epic
	if (roll < 17) return RewardRarity.Rare
	if (roll < 45) return RewardRarity.Uncommon
	return RewardRarity.Common
}

export function getRunLevelRarityMultiplier(rarity: RewardRarity) {
	switch (rarity) {
		case RewardRarity.Uncommon: return 1.25
		case RewardRarity.Rare: return 1.5
		case RewardRarity.Epic: return 2
		case RewardRarity.Legendary: return 3
		default: return 1
	}
}

export function getRunLevelBonusValue(
	definition: RunLevelBonusDefinition,
	rarity: RewardRarity
) {
	return definition.baseValue * getRunLevelRarityMultiplier(rarity)
}

export function applyRunLevelBonuses(target: RunLevelPlayerStats) {
	const damageMultiplier = 1 + 0.08 * bonusPower.weaponDamage
	target.blasterDmgMultiplier *= damageMultiplier
	target.rocketDmgMultiplier *= damageMultiplier
	target.followerBlasterDmgMultiplier *= damageMultiplier
	target.blasterSpeedMultiplier *= 1 + 0.1 * bonusPower.projectileSpeed
	target.speedMultiplier *= 1 + 0.07 * bonusPower.moveSpeed
	target.critChance += 3 * bonusPower.criticalChance
	target.debreeSeekDistanceMultiplier *= 1 + 0.15 * bonusPower.collectionRange
	target.rocketSplashSizeMultiplier *= 1 + 0.1 * bonusPower.blastRadius
}

function createEmptyBonusStacks(): Record<RunLevelBonusId, number> {
	return {
		weaponDamage: 0,
		projectileSpeed: 0,
		moveSpeed: 0,
		criticalChance: 0,
		collectionRange: 0,
		blastRadius: 0,
	}
}

function resetBonusStacks() {
	for (const id of Object.keys(bonusStacks) as RunLevelBonusId[]) {
		bonusStacks[id] = 0
		bonusPower[id] = 0
	}
}
