import { editorState, setCurrentLayer } from "../state/editorState"
import { redrawGrid } from "../rendering/gridRenderer"

/**
 * Add a new layer to the grid
 */
export function addLayer(): void {
	if (!editorState.grid) return

	editorState.grid.addLayer()
	editorState.layers.push({ isVisible: true, brightness: 1.0 })
	console.log(`Layer added. Total layers: ${editorState.grid.layers}`)
}

/**
 * Toggle visibility of a layer
 */
export function toggleLayerVisibility(layer: number): void {
	editorState.layers[layer].isVisible = !editorState.layers[layer].isVisible
	redrawGrid()
}

/**
 * Switch to a different layer
 */
export function switchToLayer(layer: number): void {
	if (!editorState.grid) return
	if (layer < 0 || layer >= editorState.grid.layers) return

	setCurrentLayer(layer)
}

/**
 * Update brightness for a layer
 */
export function setLayerBrightness(layer: number, brightness: number): void {
	if (layer >= 0 && layer < editorState.layers.length) {
		editorState.layers[layer].brightness = brightness
		redrawGrid()
	}
}

/**
 * Toggle outline visibility
 */
export function toggleOutlines(): void {
	editorState.ui.showOutlines = !editorState.ui.showOutlines
	redrawGrid()
	console.log(`Outlines: ${editorState.ui.showOutlines ? "ON" : "OFF"}`)
}
