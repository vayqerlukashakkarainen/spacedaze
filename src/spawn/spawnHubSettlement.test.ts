import {
	getHubSettlementState,
	HUB_SETTLEMENT_PLOTS,
} from "../services/hub/hubSettlementService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

assert(HUB_SETTLEMENT_PLOTS.length === 9, "Hub should contain nine settlement plots")

const levelOne = getHubSettlementState(1)
assert(levelOne.filter((plot) => plot.built).length === 3, "Hub level 1 should begin with three completed buildings")
assert(levelOne.filter((plot) => !plot.built).length === 6, "Hub level 1 should show six ruins")

for (const level of [2, 3, 4, 5, 6, 8]) {
	const previousBuilt = getHubSettlementState(level - 1).filter((plot) => plot.built).length
	const currentBuilt = getHubSettlementState(level).filter((plot) => plot.built).length
	assert(currentBuilt === previousBuilt + 1, `Hub level ${level} should replace exactly one ruin`)
}

assert(
	getHubSettlementState(7).filter((plot) => plot.built).length ===
		getHubSettlementState(6).filter((plot) => plot.built).length,
	"Hub level 7 should not add a settlement beside the training grounds"
)

console.log("Hub settlement progression tests passed")
