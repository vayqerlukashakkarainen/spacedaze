import assert from "node:assert/strict"
import {
	getEnemyProgressionRoster,
	isEnemyProgressionUnlocked,
} from "./enemyProgressionService"

const roster = getEnemyProgressionRoster()

assert.equal(roster.length, 30)
for (const enemyId of [
	"wake-scrappers-hut",
	"wake-clampback",
	"wake-fuse-rat",
	"wake-shredder-skiff",
	"wake-magnet-maw",
	"wake-railbreaker-rig",
] as const) {
	assert.equal(
		roster.some((enemy) => enemy.id === enemyId),
		true,
		`${enemyId} should be included in enemy progression`
	)
}
assert.equal(
	isEnemyProgressionUnlocked("wake-scrap-raiser", { runDepth: 1, hubLevel: 1 }),
	true
)
assert.equal(roster.filter((enemy) => enemy.id !== "orbit-lancer").every((enemy) =>
	isEnemyProgressionUnlocked(enemy.id, { runDepth: 1, hubLevel: 1 })
), true)
assert.equal(
	isEnemyProgressionUnlocked("orbit-lancer", { runDepth: 2, hubLevel: 1 }),
	false
)
assert.equal(
	isEnemyProgressionUnlocked("orbit-lancer", { runDepth: 3, hubLevel: 1 }),
	true
)
assert.equal(roster.every((enemy) =>
	!isEnemyProgressionUnlocked(enemy.id, { runDepth: 0, hubLevel: 0 })
), true)

console.log("Enemy progression tests passed")
