import { k } from "../../main"
import { HexGrid } from "../../grid/hexGrid"
import { hexCoord } from "../../grid/hexCoord"
import { CellType } from "../../grid/hexGrid"
import { editorState } from "../state/editorState"
import { redrawGrid } from "../rendering/gridRenderer"
import { gridToPattern } from "../editorPatterns"
import { gridRegistry } from "../../grid/gridRegistry"

/**
 * Paint current cell with selected tool
 */
export function paintCell(): void {
	if (!editorState.grid || !editorState.hoveredCell) return

	editorState.grid.setCell(editorState.hoveredCell, editorState.currentTool)
	redrawGrid()
}

/**
 * Clear current cell (set to empty)
 */
export function clearCell(): void {
	if (!editorState.grid || !editorState.hoveredCell) return

	editorState.grid.setCell(editorState.hoveredCell, CellType.Empty)
	redrawGrid()
}

/**
 * Clear entire grid
 */
export function clearGrid(): void {
	if (!editorState.grid) return

	editorState.grid.generateEmpty()
	redrawGrid()
	console.log("Grid cleared")
}

/**
 * Resize grid to new dimensions
 */
export function resizeGrid(): void {
	if (!editorState.grid) return

	// Save current pattern
	const oldPattern = gridToPattern(editorState.grid, "temp")
	const oldLayers = editorState.grid.layers

	// Create new grid with same number of layers
	const center = k.center()
	editorState.grid = new HexGrid(
		{
			width: editorState.gridSize.width,
			height: editorState.gridSize.height,
			hexSize: 30,
			offset: k.vec2(center.x - 300, center.y - 200),
		},
		oldLayers
	)
	editorState.grid.setCurrentLayer(editorState.currentLayer)
	gridRegistry.register("editor", editorState.grid)

	// Try to restore pattern if it fits
	if (
		oldPattern.width <= editorState.gridSize.width &&
		oldPattern.height <= editorState.gridSize.height
	) {
		for (const [coordStr, cellType] of Object.entries(oldPattern.cells)) {
			const [q, r] = coordStr.split(",").map(Number)
			editorState.grid.setCell(
				hexCoord(q, r),
				cellType,
				editorState.currentLayer
			)
		}
	}

	redrawGrid()
	console.log(
		`Grid resized to ${editorState.gridSize.width}x${editorState.gridSize.height}`
	)
}

/**
 * Update hovered cell based on mouse position
 */
export function updateHoveredCell(): void {
	if (!editorState.grid) return

	// Convert mouse screen position to world position (accounting for camera offset and zoom)
	const mouseScreenPos = k.mousePos()
	const camPos = k.getCamPos()
	const camScale = k.getCamScale()

	// Account for zoom when converting screen to world coordinates
	const worldPos = k.vec2(
		(mouseScreenPos.x - k.width() / 2) / camScale.x + camPos.x,
		(mouseScreenPos.y - k.height() / 2) / camScale.y + camPos.y
	)
	const hexCoordResult = editorState.grid.screenToHex(worldPos)

	if (editorState.grid.inBounds(hexCoordResult)) {
		editorState.hoveredCell = hexCoordResult

		// Highlight hovered cell
		k.destroyAll("hover")
		const corners = editorState.grid.getHexScreenCorners(hexCoordResult)
		k.add([
			k.polygon(corners),
			k.outline(2, new k.Color(255, 255, 0)),
			k.opacity(0),
			"levelEditor",
			"hover",
		])
	} else {
		editorState.hoveredCell = undefined
		k.destroyAll("hover")
	}
}
