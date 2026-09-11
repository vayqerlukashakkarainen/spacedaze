import type { HexCoord } from "../../generation/hexUtils"

const REMOVED_FLOOR_CELL_KEYS = new Set([
	"4,-1",
	"4,-2",
	"3,1",
	"-1,4",
	"-4,1",
	"-3,-1",
	"0,-4",
	"2,0",
])

const EXTENDED_FLOOR_CELLS: readonly HexCoord[] = [
	{ q: 5, r: -3 },
	{ q: -5, r: 3 },
	{ q: 0, r: 5 },
]

const REPAIRED_FLOOR_MATERIALS = new Map<string, number>([
	["-3,2", 0],
	["-1,-1", 2],
	["0,2", 2],
	["2,-2", 0],
	["1,2", 2],
])

export const HUB_RESTORATION_FLOOR_STAMP = {
	id: "hub-restoration-floor",
	offset: [0, 0] as const,
	hexRadius: 4,
	hexSize: 40,
	material: 1,
	lampRingRadius: 235,
	lampRingOffsetY: -10,
	tint: [128, 128, 128] as const,
	opacity: 1,
	z: -4,
}

export function createHubRestorationFloorStampCells(): HexCoord[] {
	const cells: HexCoord[] = []
	for (
		let q = -HUB_RESTORATION_FLOOR_STAMP.hexRadius;
		q <= HUB_RESTORATION_FLOOR_STAMP.hexRadius;
		q++
	) {
		for (
			let r = -HUB_RESTORATION_FLOOR_STAMP.hexRadius;
			r <= HUB_RESTORATION_FLOOR_STAMP.hexRadius;
			r++
		) {
			if (
				Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <=
				HUB_RESTORATION_FLOOR_STAMP.hexRadius
			) {
				const coord = { q, r }
				if (!REMOVED_FLOOR_CELL_KEYS.has(cellKey(coord))) cells.push(coord)
			}
		}
	}
	cells.push(...EXTENDED_FLOOR_CELLS)
	return cells
}

export function getHubRestorationFloorStampMaterial(coord: HexCoord): number {
	return REPAIRED_FLOOR_MATERIALS.get(cellKey(coord)) ??
		HUB_RESTORATION_FLOOR_STAMP.material
}

function cellKey(coord: HexCoord): string {
	return `${coord.q},${coord.r}`
}
