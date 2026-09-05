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
	value: string
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
		value: "+8%",
		sprite: "blaster_upg_dmg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "projectileSpeed",
		name: "BALLISTIC COILS",
		description: "Increase the velocity of primary weapon projectiles",
		stat: "PROJECTILE SPEED",
		value: "+10%",
		sprite: "blaster_upg_speed1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "moveSpeed",
		name: "THRUSTER TUNING",
		description: "Increase ship movement speed for the rest of this expedition",
		stat: "MOVE SPEED",
		value: "+7%",
		sprite: "faster_speed_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "criticalChance",
		name: "TARGETING CACHE",
		description: "Increase the critical-hit chance of compatible weapons",
		stat: "CRITICAL CHANCE",
		value: "+3%",
		sprite: "parallel_blasters_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "collectionRange",
		name: "MAGNET ARRAY",
		description: "Increase the distance from which the ship attracts debris",
		stat: "COLLECTION RANGE",
		value: "+15%",
		sprite: "debree_dist_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
	{
		id: "blastRadius",
		name: "EXPANSION CHARGE",
		description: "Increase the blast radius of missiles and explosive effects",
		stat: "BLAST RADIUS",
		value: "+10%",
		sprite: "rocket_upg1",
		rarity: RewardRarity.Common,
		maxStacks: 8,
	},
]

const bonusStacks = createEmptyBonusStacks()
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

export function grantRunLevelBonus(id: RunLevelBonusId) {
	const definition = RUN_LEVEL_BONUSES.find((bonus) => bonus.id === id)
	if (!definition || bonusStacks[id] >= definition.maxStacks) return false
	bonusStacks[id]++
	return true
}

export function applyRunLevelBonuses(target: RunLevelPlayerStats) {
	const damageMultiplier = Math.pow(1.08, bonusStacks.weaponDamage)
	target.blasterDmgMultiplier *= damageMultiplier
	target.rocketDmgMultiplier *= damageMultiplier
	target.followerBlasterDmgMultiplier *= damageMultiplier
	target.blasterSpeedMultiplier *= Math.pow(1.1, bonusStacks.projectileSpeed)
	target.speedMultiplier *= Math.pow(1.07, bonusStacks.moveSpeed)
	target.critChance += bonusStacks.criticalChance * 3
	target.debreeSeekDistanceMultiplier *= Math.pow(1.15, bonusStacks.collectionRange)
	target.rocketSplashSizeMultiplier *= Math.pow(1.1, bonusStacks.blastRadius)
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
	}
}
