import assert from "node:assert/strict"
import { GenerationMap, type GenCell } from "../../generation/generationTypes"
import { planRunVillageZones } from "./runVillageService"

function createVillageTestMap() {
	const map = new GenerationMap(30, 24)
	for (let q = 0; q < map.width; q++) {
		for (let r = 0; r < map.height; r++) {
			const open = q >= 6 && q <= 23 && r >= 5 && r <= 18
			const cell: GenCell = {
				coord: { q, r },
				solid: !open,
				hardness: open ? 0 : 1,
				density: open ? 0 : 1,
				regionId: open ? 0 : -1,
				tags: new Set(),
				locked: false,
			}
			map.setCell(cell.coord, cell)
		}
	}
	map.getCell({ q: 15, r: 12 })?.tags.add("player_spawn")
	map.getCell({ q: 6, r: 10 })?.tags.add("destructible_wall")
	return map
}

const firstMap = createVillageTestMap()
const first = planRunVillageZones(firstMap, 8421)
const second = planRunVillageZones(createVillageTestMap(), 8421)

assert.deepEqual(first, second)
assert.ok(first.length >= 1)
assert.ok(first.length <= 3)

for (const zone of first) {
	assert.ok(zone.plots.length >= 2)
	assert.equal(
		firstMap.getCell(zone.anchor)?.tags.has("village_anchor"),
		true
	)
	for (const plot of zone.plots) {
		const cell = firstMap.getCell(plot.coord)
		assert.equal(cell?.solid, true)
		assert.equal(cell?.tags.has("village_plot"), true)
		assert.equal(cell?.tags.has("destructible_wall"), false)
	}
}

console.log("Run village service tests passed")
