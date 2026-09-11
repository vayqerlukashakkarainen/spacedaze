import assert from "node:assert/strict"
import { generateRoomFloor } from "../../generation/rooms/roomFloorGenerator"
import { createWakeEncounterEnemies } from "./wakeEncounterService"
import { getWakeEnemyMalfunctionChance } from "./wakeMalfunctionBalance"
import { getWakeMiniBossRoster } from "./wakeMiniBossService"

const malfunctionLevels = [2, 5, 6, 7, 8, 10]
const malfunctionChances = malfunctionLevels.map((level) =>
	getWakeEnemyMalfunctionChance(level, false)
)
assert.equal(malfunctionChances[0], 0.35)
assert(Math.abs((malfunctionChances.at(-1) ?? 0) - 0.11) < 0.000001)
assert(
	malfunctionChances.every((chance, index) =>
		index === 0 || chance < malfunctionChances[index - 1]
	),
	"Stronger Wake enemies should have a lower malfunction chance"
)

const miniBosses = new Set<string>(getWakeMiniBossRoster())
assert(
	getWakeEnemyMalfunctionChance(5, true) <
		getWakeEnemyMalfunctionChance(5, false),
	"Elite Wake enemies should have a lower malfunction chance"
)

for (let tier = 1; tier <= 5; tier++) {
	const firstFormation = createWakeEncounterEnemies(tier, () => 0)
	const lastFormation = createWakeEncounterEnemies(tier, () => 0.999999)
	assert(firstFormation.length > 0, `Wake tier ${tier} has no first formation`)
	assert(
		firstFormation.includes("wake-scrappers-hut"),
		`Wake tier ${tier} should include a Scrapper's Hut formation`
	)
	assert(lastFormation.length > 0, `Wake tier ${tier} has no last formation`)
	assert(
		[...firstFormation, ...lastFormation].every((enemyId) =>
			enemyId.startsWith("wake-") && !miniBosses.has(enemyId)
		),
		`Wake tier ${tier} contains an invalid standard-room enemy`
	)
}

for (let tier = 1; tier <= 5; tier++) {
	for (const randomValue of [0, 0.5, 0.999999]) {
		const openingEnemies = createWakeEncounterEnemies(
			tier,
			() => randomValue,
			1
		)
		for (const gatedEnemy of [
			"wake-rivet-gunner",
			"wake-fuse-rat",
			"wake-shredder-skiff",
		] as const) {
			assert(
				!openingEnemies.includes(gatedEnemy),
				`Wake tier ${tier} introduced ${gatedEnemy} on sublevel 1.1`
			)
		}
	}
}
assert(
	createWakeEncounterEnemies(1, () => 0.999999, 2)
		.includes("wake-rivet-gunner"),
	"Rivet Gunners should unlock on sublevel 1.2"
)
assert(
	createWakeEncounterEnemies(1, () => 0.999999, 2)
		.includes("wake-fuse-rat"),
	"Fuse Rats should join the Wake roster on sublevel 1.2"
)
assert(
	createWakeEncounterEnemies(2, () => 0.999999, 2)
		.includes("wake-shredder-skiff"),
	"Shredder Skiffs should join the Wake roster on sublevel 1.2"
)
assert(
	createWakeEncounterEnemies(1, () => 0.65, 1)
		.includes("wake-clampback"),
	"Clampbacks should diversify the opening sublevel"
)

const wakeFloor = generateRoomFloor(777, 1, { roomCount: 16 })
const federationFloor = generateRoomFloor(777, 8, { roomCount: 16 })
assert(
	wakeFloor.rooms
		.flatMap((room) => room.encounter?.enemies ?? [])
		.every((enemy) => enemy.enemyId.startsWith("wake-")),
	"Wake Scrap District rooms should use the Wake enemy family"
)
assert(
	federationFloor.rooms
		.flatMap((room) => room.encounter?.enemies ?? [])
		.every((enemy) => !enemy.enemyId.startsWith("wake-")),
	"Other floor themes should keep their own enemy family"
)

console.log("Wake encounter tests passed")
