import assert from "node:assert/strict"
import {
	addRunLevelXp,
	applyRunLevelBonuses,
	beginRunLevelProgression,
	consumeRunLevelSelection,
	endRunLevelProgression,
	getRunLevelSnapshot,
	grantRunLevelBonus,
} from "./runLevelService"

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
			projectileSpeed: 0,
			moveSpeed: 0,
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

assert.equal(grantRunLevelBonus("weaponDamage"), true)
assert.equal(grantRunLevelBonus("moveSpeed"), true)
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
assert.equal(stats.blasterDmgMultiplier, 2.16)
assert.equal(stats.rocketDmgMultiplier, 1.08)
assert.equal(stats.speedMultiplier, 1.07)

endRunLevelProgression()
assert.equal(getRunLevelSnapshot().active, false)
assert.equal(getRunLevelSnapshot().level, 1)
assert.equal(getRunLevelSnapshot().bonuses.weaponDamage, 0)

console.log("run level service tests passed")
