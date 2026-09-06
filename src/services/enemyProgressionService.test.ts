import assert from "node:assert/strict"
import {
	getEnemyProgressionRoster,
	isEnemyProgressionUnlocked,
} from "./enemyProgressionService"

const roster = getEnemyProgressionRoster()

assert.equal(roster.length, 18)
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
