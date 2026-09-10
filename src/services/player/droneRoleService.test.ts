import assert from "node:assert/strict"
import { assignDroneTypes } from "./droneRoleService"

const fullRoster = assignDroneTypes(6, {
	missile: 1,
	interceptor: 1,
	gunship: 1,
	medic: 1,
	salvager: 1,
})
assert.deepEqual(fullRoster, [
	"missile",
	"interceptor",
	"gunship",
	"medic",
	"salvager",
	"combat",
])

const limitedRoster = assignDroneTypes(2, {
	missile: 1,
	interceptor: 1,
	gunship: 1,
	medic: 1,
	salvager: 1,
})
assert.deepEqual(limitedRoster, ["missile", "interceptor"])

const combatRoster = assignDroneTypes(3, {
	missile: 0,
	interceptor: 0,
	gunship: 0,
	medic: 0,
	salvager: 0,
})
assert.deepEqual(combatRoster, ["combat", "combat", "combat"])

console.log("Drone role assignment tests passed")
