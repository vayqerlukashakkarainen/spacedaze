import { RewardRarity } from "../types/rewardTypes"
import {
	CHEST_OPENING_MODE,
	getDirectChestOpeningProfile,
	getHighestChestRewardRarity,
} from "./chestOpeningMode"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

assert(
	CHEST_OPENING_MODE === "direct",
	"the temporary playtest mode should route chests through direct opening"
)

const rarityOrder = Object.values(RewardRarity)
for (let index = 1; index < rarityOrder.length; index++) {
	const previous = getDirectChestOpeningProfile(rarityOrder[index - 1])
	const current = getDirectChestOpeningProfile(rarityOrder[index])
	assert(
		current.duration > previous.duration,
		"more valuable rewards should charge for longer"
	)
	assert(
		current.rayCount > previous.rayCount,
		"more valuable rewards should create more godrays"
	)
	assert(
		current.burstParticleCount > previous.burstParticleCount,
		"more valuable rewards should create larger particle bursts"
	)
	assert(
		current.chargeScale > previous.chargeScale,
		"more valuable rewards should scale the chest further"
	)
}

assert(
	getHighestChestRewardRarity([
		{ rarity: RewardRarity.Uncommon },
		{ rarity: RewardRarity.Legendary },
		{ rarity: RewardRarity.Rare },
	]) === RewardRarity.Legendary,
	"direct opening should charge from the most valuable contained reward"
)

console.log("Chest opening mode tests passed")
