import {
	getHubSettlementState,
	HUB_SETTLEMENT_PLOTS,
} from "../services/hub/hubSettlementService"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

assert(HUB_SETTLEMENT_PLOTS.length === 8, "Hub should contain eight settlement plots")
assert(
	HUB_SETTLEMENT_PLOTS.filter((plot) => plot.facing === "left").length === 4,
	"Hub settlement plots should mix left- and right-facing scenery"
)

const levelOne = getHubSettlementState(1)
assert(levelOne.filter((plot) => plot.built).length === 3, "Hub level 1 should begin with three completed buildings")
assert(levelOne.filter((plot) => !plot.built).length === 5, "Hub level 1 should show five ruins")

for (const level of [2, 3, 4, 5, 8]) {
	const previousBuilt = getHubSettlementState(level - 1).filter((plot) => plot.built).length
	const currentBuilt = getHubSettlementState(level).filter((plot) => plot.built).length
	assert(currentBuilt === previousBuilt + 1, `Hub level ${level} should replace exactly one ruin`)
}

assert(
	getHubSettlementState(7).filter((plot) => plot.built).length ===
		getHubSettlementState(5).filter((plot) => plot.built).length,
	"Hub levels 6 and 7 should not add settlement buildings"
)

console.log("Hub settlement progression tests passed")
