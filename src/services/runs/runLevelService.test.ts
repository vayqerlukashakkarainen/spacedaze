import assert from "node:assert/strict"
import {
	addRunLevelXp,
	applyRunLevelBonuses,
	beginRunLevelProgression,
	consumeRunLevelSelection,
	drawRunLevelOfferIds,
	endRunLevelProgression,
	getRunLevelSnapshot,
	grantRunLevelBonus,
	RUN_LEVEL_BONUSES,
	rollRunLevelBonusRarity,
} from "./runLevelService"
import { RewardRarity } from "../../types/rewardTypes"

beginRunLevelProgression()
assert.deepEqual(
	getRunLevelSnapshot(),
	{
		active: true,
		level: 1,
		xp: 0,
		requiredXp: 20,
		progress: 0,
		pendingSelections: 0,
		bonuses: {
			weaponDamage: 0,
			criticalChance: 0,
			collectionRange: 0,
			blastRadius: 0,
		},
		bonusPower: {
			weaponDamage: 0,
			criticalChance: 0,
			collectionRange: 0,
			blastRadius: 0,
		},
	}
)

assert.equal(addRunLevelXp(55), 55)
assert.equal(getRunLevelSnapshot().level, 3)
assert.equal(getRunLevelSnapshot().xp, 5)
assert.equal(getRunLevelSnapshot().pendingSelections, 2)
assert.equal(consumeRunLevelSelection(), true)
assert.equal(getRunLevelSnapshot().pendingSelections, 1)

assert.equal(grantRunLevelBonus("weaponDamage", RewardRarity.Rare), true)
assert.equal(
	RUN_LEVEL_BONUSES.some((bonus) => bonus.stat === "MOVE SPEED"),
	false
)
const stats = {
	blasterDmgMultiplier: 2,
	rocketDmgMultiplier: 1,
	followerBlasterDmgMultiplier: 1,
	blasterSpeedMultiplier: 1,
	speedMultiplier: 1,
	critChance: 5,
	debreeSeekDistanceMultiplier: 1,
	rocketSplashSizeMultiplier: 1,
}
applyRunLevelBonuses(stats)
assert.equal(stats.blasterDmgMultiplier, 2.24)
assert.equal(stats.rocketDmgMultiplier, 1.12)
assert.equal(stats.speedMultiplier, 1)
assert.equal(rollRunLevelBonusRarity(() => 0), RewardRarity.Legendary)
assert.equal(rollRunLevelBonusRarity(() => 0.02), RewardRarity.Epic)
assert.equal(rollRunLevelBonusRarity(() => 0.1), RewardRarity.Rare)
assert.equal(rollRunLevelBonusRarity(() => 0.3), RewardRarity.Uncommon)
assert.equal(rollRunLevelBonusRarity(() => 0.9), RewardRarity.Common)

const passiveIds = ["damage", "speed", "health", "range", "critical", "blast"]
const firstOffers = drawRunLevelOfferIds("passive", passiveIds, 2, () => 0)
const secondOffers = drawRunLevelOfferIds("passive", passiveIds, 2, () => 0)
const thirdOffers = drawRunLevelOfferIds("passive", passiveIds, 2, () => 0)
const fourthOffers = drawRunLevelOfferIds("passive", passiveIds, 2, () => 0)
assert.equal(firstOffers.some((id) => secondOffers.includes(id)), false)
assert.equal(secondOffers.some((id) => thirdOffers.includes(id)), false)
assert.equal(thirdOffers.some((id) => fourthOffers.includes(id)), false)
assert.deepEqual(
	new Set([...firstOffers, ...secondOffers, ...thirdOffers]),
	new Set(passiveIds)
)

assert.deepEqual(
	drawRunLevelOfferIds("special", ["armor"], 1, () => 0, false),
	["armor"]
)
assert.deepEqual(
	drawRunLevelOfferIds("special", ["armor"], 1, () => 0, false),
	[]
)
assert.deepEqual(
	drawRunLevelOfferIds("special", ["armor"], 1, () => 0, false),
	["armor"]
)

endRunLevelProgression()
assert.equal(getRunLevelSnapshot().active, false)
assert.equal(getRunLevelSnapshot().level, 1)
assert.equal(getRunLevelSnapshot().bonuses.weaponDamage, 0)

console.log("run level service tests passed")
