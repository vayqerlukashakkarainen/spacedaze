import { k } from "../../main"
import { HexGrid, CellType } from "../../grid/hexGrid"
import { editorState } from "../state/editorState"
import { drawWallCell } from "./wallRenderer"

/**
 * Draw the hex grid (all visible layers)
 */
export function drawGrid(grid: HexGrid): void {
	if (!grid) return

	// Draw cells from all visible layers
	for (const cell of grid.cells.values()) {
		// Skip if layer is not visible
		if (!editorState.layers[cell.layer]?.isVisible) continue
		const corners = grid.getHexScreenCorners(cell.coord)

		if (cell.type === CellType.Wall) {
			// Wall cells - render as 3D boxes with neighbor-aware merging
			drawWallCell(corners, cell, grid, 1)
		} else if (cell.type === CellType.Obstacle) {
			// Obstacle cells - solid color
			k.add([
				k.polygon(corners),
				k.color(cell.color.r, cell.color.g, cell.color.b),
				k.opacity(1),
				"levelEditor",
				"gridCell",
				{
					hexCoord: cell.coord,
					layer: cell.layer,
				},
			])
		}
	}
}

/**
 * Redraw the grid (after changes)
 */
export function redrawGrid(): void {
	k.destroyAll("gridCell")
	if (editorState.grid) {
		drawGrid(editorState.grid)
	}
}
