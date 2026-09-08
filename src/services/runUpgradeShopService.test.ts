import { RewardRarity } from "../types/rewardTypes"
import {
	getRunUpgradeShopPrice,
	selectRunUpgradeShopOffers,
} from "./runUpgradeShopService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const candidates = [
	{ id: "upgrade:blaster:1", upgradeKey: "blaster", rarity: RewardRarity.Common },
	{ id: "upgrade:blaster:2", upgradeKey: "blaster", rarity: RewardRarity.Rare },
	{ id: "upgrade:hull:1", upgradeKey: "hull", rarity: RewardRarity.Uncommon },
	{ id: "upgrade:thruster:1", upgradeKey: "thruster", rarity: RewardRarity.Epic },
	{ id: "upgrade:shield:1", upgradeKey: "shield", rarity: RewardRarity.Legendary },
]

const first = selectRunUpgradeShopOffers(412, candidates)
const second = selectRunUpgradeShopOffers(412, candidates)
assert(first.length === 3, "A shop should contain three offers")
assert(
	JSON.stringify(first) === JSON.stringify(second),
	"A room seed should always produce the same shop inventory"
)
assert(
	new Set(first.map((offer) => offer.rewardId.split(":")[1])).size === first.length,
	"A shop should not offer two levels from the same upgrade family"
)
assert(
	getRunUpgradeShopPrice(RewardRarity.Common) <
		getRunUpgradeShopPrice(RewardRarity.Legendary),
	"Higher rarity upgrades should cost more debris"
)
assert(
	getRunUpgradeShopPrice(RewardRarity.Rare, { depth: 4, difficulty: 3 }) >
		getRunUpgradeShopPrice(RewardRarity.Rare, { depth: 1, difficulty: 1 }),
	"Run depth and difficulty should increase shop prices"
)
assert(
	selectRunUpgradeShopOffers(
		412,
		candidates,
		3,
		{ depth: 4, difficulty: 3 }
	)[0].price > first[0].price,
	"Generated offers should retain their scaled price"
)

console.log("Run upgrade shop tests passed")
