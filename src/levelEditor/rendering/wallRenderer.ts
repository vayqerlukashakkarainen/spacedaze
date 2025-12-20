import { Vec2 } from "kaplay"
import { k } from "../../main"
import { HexGrid, CellType, HexCell } from "../../grid/hexGrid"
import { editorState } from "../state/editorState"

/**
 * Calculate the center point of a hexagon from its corners
 */
export function getHexCenter(corners: Vec2[]): Vec2 {
	let sumX = 0
	let sumY = 0
	for (const corner of corners) {
		sumX += corner.x
		sumY += corner.y
	}
	return k.vec2(sumX / corners.length, sumY / corners.length)
}

/**
 * Draw a wall cell as a 3D box with shadows and neighbor-aware merging
 */
export function drawWallCell(
	corners: Vec2[],
	cell: HexCell,
	grid: HexGrid,
	opacity: number
): void {
	// Check neighbors on same layer
	const neighbors = grid.getNeighbors(cell.coord, cell.layer)
	const hasWallSW = neighbors.some(
		(n) =>
			n.coord.q === cell.coord.q - 1 &&
			n.coord.r === cell.coord.r + 1 &&
			n.type === CellType.Wall
	)
	const hasWallSE = neighbors.some(
		(n) =>
			n.coord.q === cell.coord.q &&
			n.coord.r === cell.coord.r + 1 &&
			n.type === CellType.Wall
	)

	// For a pointy-top hexagon, corners are indexed:
	// 0: right, 1: top-right, 2: top-left, 3: left, 4: bottom-left, 5: bottom-right

	// Get brightness for this layer
	const brightness = editorState.layers[cell.layer]?.brightness || 1.0
	const topColor = Math.round(120 * brightness)
	const swColor = Math.round(200 * brightness)
	const seColor = Math.round(30 * brightness)

	// Top face (white/light gray)
	k.add([
		k.polygon(corners),
		k.color(topColor, topColor, topColor),
		k.opacity(opacity),
		"levelEditor",
		"gridCell",
		{
			hexCoord: cell.coord,
			layer: cell.layer,
		},
	])

	// Southwest face (darker - unless merged with neighbor)
	if (!hasWallSW) {
		const swFace = [corners[2], corners[3], corners[4], getHexCenter(corners)]
		k.add([
			k.polygon(swFace),
			k.color(swColor, swColor, swColor),
			k.opacity(opacity),
			"levelEditor",
			"gridCell",
		])
	}

	// Southeast face (darkest - unless merged with neighbor)
	if (!hasWallSE) {
		const seFace = [corners[0], corners[1], corners[2], getHexCenter(corners)]
		k.add([
			k.polygon(seFace),
			k.color(seColor, seColor, seColor),
			k.opacity(opacity),
			"levelEditor",
			"gridCell",
		])
	}
}
