import { SeededRNG } from "../generation/seededRng"
import type { RoomShopOffer } from "../generation/rooms/roomFloorTypes"
import { RewardRarity } from "../types/rewardTypes"

export interface RunUpgradeShopCandidate {
	id: string
	upgradeKey?: string
	rarity: RewardRarity
}

const PRICE_BY_RARITY: Readonly<Record<RewardRarity, number>> = {
	[RewardRarity.Common]: 10,
	[RewardRarity.Uncommon]: 18,
	[RewardRarity.Rare]: 30,
	[RewardRarity.Epic]: 48,
	[RewardRarity.Legendary]: 80,
}

export interface RunUpgradeShopPricingContext {
	depth: number
	difficulty: number
}

const DEPTH_PRICE_STEP = 0.15
const DIFFICULTY_PRICE_STEP = 0.2

export function getRunUpgradeShopPrice(
	rarity: RewardRarity,
	context: RunUpgradeShopPricingContext = { depth: 1, difficulty: 1 }
) {
	const depth = Math.max(1, Math.floor(context.depth))
	const difficulty = Math.max(1, Math.floor(context.difficulty))
	const multiplier = 1 +
		(depth - 1) * DEPTH_PRICE_STEP +
		(difficulty - 1) * DIFFICULTY_PRICE_STEP
	return Math.max(1, Math.round(PRICE_BY_RARITY[rarity] * multiplier))
}

export function selectRunUpgradeShopOffers(
	seed: number,
	candidates: readonly RunUpgradeShopCandidate[],
	count: number = 3,
	pricing: RunUpgradeShopPricingContext = { depth: 1, difficulty: 1 }
): RoomShopOffer[] {
	const seenFamilies = new Set<string>()
	const uniqueCandidates = candidates.filter((candidate) => {
		const family = candidate.upgradeKey ?? candidate.id
		if (seenFamilies.has(family)) return false
		seenFamilies.add(family)
		return true
	})
	const rng = new SeededRNG(seed ^ 0x5a0f51)
	return rng.shuffle([...uniqueCandidates])
		.slice(0, Math.max(0, Math.floor(count)))
		.map((candidate) => ({
			rewardId: candidate.id,
			rarity: candidate.rarity,
			price: getRunUpgradeShopPrice(candidate.rarity, pricing),
			purchased: false,
		}))
}
