import {
	getHubSettlementState,
	HUB_SETTLEMENT_PLOTS,
} from "../services/hub/hubSettlementService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

assert(HUB_SETTLEMENT_PLOTS.length === 10, "Hub should contain ten settlement plots")

const levelOne = getHubSettlementState(1)
assert(levelOne.filter((plot) => plot.built).length === 3, "Hub level 1 should begin with three completed buildings")
assert(levelOne.filter((plot) => !plot.built).length === 7, "Hub level 1 should show seven ruins")

for (let level = 2; level <= 8; level++) {
	const previousBuilt = getHubSettlementState(level - 1).filter((plot) => plot.built).length
	const currentBuilt = getHubSettlementState(level).filter((plot) => plot.built).length
	assert(currentBuilt === previousBuilt + 1, `Hub level ${level} should replace exactly one ruin`)
}

console.log("Hub settlement progression tests passed")
