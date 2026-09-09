import assert from "node:assert/strict"
import { generateRoomFloor } from "../generation/rooms/roomFloorGenerator"
import { createWakeEncounterEnemies } from "./wakeEncounterService"

for (let tier = 1; tier <= 5; tier++) {
	const firstFormation = createWakeEncounterEnemies(tier, () => 0)
	const lastFormation = createWakeEncounterEnemies(tier, () => 0.999999)
	assert(firstFormation.length > 0, `Wake tier ${tier} has no first formation`)
	assert(lastFormation.length > 0, `Wake tier ${tier} has no last formation`)
	assert(
		[...firstFormation, ...lastFormation].every((enemyId) =>
			enemyId.startsWith("wake-") && enemyId !== "wake-boiler-hulk"
		),
		`Wake tier ${tier} contains an invalid standard-room enemy`
	)
}

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
