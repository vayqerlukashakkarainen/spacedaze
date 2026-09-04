import assert from "node:assert/strict"
import {
	ACTIVE_MODULES,
	beginActiveModuleActivation,
	equipActiveModule,
	ensureDefaultActiveModule,
	getActiveModuleCooldownRemaining,
	getEquippedActiveModuleId,
	resetActiveModule,
	updateActiveModuleCooldown,
} from "./activeModuleService"

assert.equal(ACTIVE_MODULES.length, 5)

resetActiveModule()
ensureDefaultActiveModule(false)
assert.equal(getEquippedActiveModuleId(), undefined)

ensureDefaultActiveModule(true)
assert.equal(getEquippedActiveModuleId(), "rocketPod")
assert.equal(beginActiveModuleActivation()?.id, "rocketPod")
assert.equal(beginActiveModuleActivation(), undefined)

updateActiveModuleCooldown(5.5)
assert.equal(getActiveModuleCooldownRemaining(), 0.5)
updateActiveModuleCooldown(1)
assert.equal(getActiveModuleCooldownRemaining(), 0)

equipActiveModule("gravityCharge")
assert.equal(getEquippedActiveModuleId(), "gravityCharge")
assert.equal(getActiveModuleCooldownRemaining(), 0)
assert.equal(beginActiveModuleActivation()?.id, "gravityCharge")

resetActiveModule()

console.log("activeModuleService tests passed")
