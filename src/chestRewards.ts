import { k } from "./main"
import { PowerupKey, powerupReq, powerupsSprites } from "./powerups"

export enum Rarity {
	Common = "COMMON",
	Uncommon = "UNCOMMON",
	Rare = "RARE",
	Epic = "EPIC",
}

export interface ChestReward {
	name: string
	description: string
	sprite: string
	rarity: Rarity
	powerupKey: PowerupKey
}

// Rarity weights based on timing minigame performance
interface RarityWeights {
	common: number
	uncommon: number
	rare: number
	epic: number
}

const baseWeights: RarityWeights = {
	common: 600,
	uncommon: 300,
	rare: 80,
	epic: 20,
}

const weights1Hit: RarityWeights = {
	common: 450,
	uncommon: 350,
	rare: 150,
	epic: 50,
}

const weights2Hits: RarityWeights = {
	common: 300,
	uncommon: 350,
	rare: 250,
	epic: 100,
}

const weights3Hits: RarityWeights = {
	common: 150,
	uncommon: 300,
	rare: 350,
	epic: 200,
}

// Map powerups to rarities
const powerupRarities: Record<PowerupKey, Rarity> = {
	addFollower: Rarity.Epic,
	addPlayerMaxHealth: Rarity.Rare,
	addExtraRockets: Rarity.Uncommon,
	addSpaceDebree: Rarity.Common,
	slowdownTime: Rarity.Uncommon,
}

// Powerup display names and descriptions
const powerupInfo: Record<PowerupKey, { name: string; desc: string }> = {
	addFollower: {
		name: "COMBAT DRONE",
		desc: "Spawns a follower drone to fight by your side",
	},
	addPlayerMaxHealth: {
		name: "HULL REINFORCEMENT",
		desc: "Increases your maximum health by 1",
	},
	addExtraRockets: {
		name: "MISSILE CACHE",
		desc: "Adds 1 extra rocket to your arsenal",
	},
	addSpaceDebree: {
		name: "SHRAPNEL PAYLOAD",
		desc: "Adds 2 extra shrapnel to your missiles",
	},
	slowdownTime: {
		name: "TIME DILATOR",
		desc: "Slows down time for 6 seconds",
	},
}

function getWeightsForHits(hits: number): RarityWeights {
	if (hits === 0) return baseWeights
	if (hits === 1) return weights1Hit
	if (hits === 2) return weights2Hits
	return weights3Hits
}

function selectRarity(hits: number): Rarity {
	const weights = getWeightsForHits(hits)
	const total =
		weights.common + weights.uncommon + weights.rare + weights.epic

	const r = k.rand(0, total)

	if (r < weights.common) return Rarity.Common
	if (r < weights.common + weights.uncommon) return Rarity.Uncommon
	if (r < weights.common + weights.uncommon + weights.rare) return Rarity.Rare
	return Rarity.Epic
}

function getAvailablePowerups(): PowerupKey[] {
	return Object.keys(powerupRarities).filter((key) => {
		const powerupKey = key as PowerupKey
		const requirement = powerupReq[powerupKey]
		if (requirement === undefined) return true
		return requirement()
	}) as PowerupKey[]
}

function selectPowerupByRarity(rarity: Rarity): PowerupKey | undefined {
	const available = getAvailablePowerups()
	const matching = available.filter((key) => powerupRarities[key] === rarity)

	if (matching.length === 0) {
		// Fallback: try next lower rarity
		if (rarity === Rarity.Epic) return selectPowerupByRarity(Rarity.Rare)
		if (rarity === Rarity.Rare) return selectPowerupByRarity(Rarity.Uncommon)
		if (rarity === Rarity.Uncommon)
			return selectPowerupByRarity(Rarity.Common)
		// If still nothing, just pick any available
		if (available.length > 0) {
			return available[Math.floor(k.rand(0, available.length))]
		}
		return undefined
	}

	return matching[Math.floor(k.rand(0, matching.length))]
}

export function generateChestReward(successfulHits: number): ChestReward | undefined {
	const rarity = selectRarity(successfulHits)
	const powerupKey = selectPowerupByRarity(rarity)

	if (!powerupKey) {
		// Fallback to any available powerup
		const available = getAvailablePowerups()
		if (available.length === 0) return undefined

		const fallbackKey = available[Math.floor(k.rand(0, available.length))]
		const fallbackRarity = powerupRarities[fallbackKey]

		return {
			name: powerupInfo[fallbackKey].name,
			description: powerupInfo[fallbackKey].desc,
			sprite: powerupsSprites[fallbackKey],
			rarity: fallbackRarity,
			powerupKey: fallbackKey,
		}
	}

	return {
		name: powerupInfo[powerupKey].name,
		description: powerupInfo[powerupKey].desc,
		sprite: powerupsSprites[powerupKey],
		rarity: rarity,
		powerupKey: powerupKey,
	}
}
