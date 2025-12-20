import { k } from "../../main"
import { changeGameState, GameState } from "../../main"
import { CellType } from "../../grid/hexGrid"
import { editorState, setCurrentTool, setGridSize } from "../state/editorState"
import { resizeGrid } from "../actions/gridActions"
import { savePattern } from "../actions/patternActions"
import { switchToLayer } from "../actions/layerActions"
import { redrawGrid } from "../rendering/gridRenderer"
import { updateToolLabel, updateSizeLabel, updateLayerLabel, updateBrightnessSliderPosition, updateLayerToggles } from "../ui/StatusBar"

/**
 * Setup editor keyboard controls
 */
export function setupKeyboardControls(): void {
	// Tool selection hotkeys
	k.onKeyPress("e", () => {
		setCurrentTool(CellType.Empty)
		updateToolLabel()
	})

	k.onKeyPress("w", () => {
		setCurrentTool(CellType.Wall)
		updateToolLabel()
	})

	k.onKeyPress("o", () => {
		setCurrentTool(CellType.Obstacle)
		updateToolLabel()
	})

	// Layer switching with [ and ]
	k.onKeyPress("[", () => {
		if (editorState.grid && editorState.currentLayer > 0) {
			switchToLayer(editorState.currentLayer - 1)
			updateLayerLabel()
			updateLayerToggles()
			updateBrightnessSliderPosition()
			redrawGrid()
		}
	})

	k.onKeyPress("]", () => {
		if (editorState.grid && editorState.currentLayer < editorState.grid.layers - 1) {
			switchToLayer(editorState.currentLayer + 1)
			updateLayerLabel()
			updateLayerToggles()
			updateBrightnessSliderPosition()
			redrawGrid()
		}
	})

	// Layer switching with Tab (cycles through all layers)
	k.onKeyPress("tab", () => {
		if (!editorState.grid) return
		const nextLayer = (editorState.currentLayer + 1) % editorState.grid.layers
		switchToLayer(nextLayer)
		updateLayerLabel()
		updateLayerToggles()
		updateBrightnessSliderPosition()
		redrawGrid()
	})

	// Grid size controls with shift+arrow keys
	k.onKeyPress("left", () => {
		if (k.isKeyDown("shift")) {
			const newWidth = Math.max(5, editorState.gridSize.width - 1)
			setGridSize(newWidth, editorState.gridSize.height)
			updateSizeLabel()
		}
	})

	k.onKeyPress("right", () => {
		if (k.isKeyDown("shift")) {
			const newWidth = Math.min(30, editorState.gridSize.width + 1)
			setGridSize(newWidth, editorState.gridSize.height)
			updateSizeLabel()
		}
	})

	k.onKeyPress("up", () => {
		if (k.isKeyDown("shift")) {
			const newHeight = Math.max(5, editorState.gridSize.height - 1)
			setGridSize(editorState.gridSize.width, newHeight)
			updateSizeLabel()
		} else if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			// Navigate to layer above
			if (editorState.grid && editorState.currentLayer < editorState.grid.layers - 1) {
				switchToLayer(editorState.currentLayer + 1)
				updateLayerLabel()
				updateLayerToggles()
				updateBrightnessSliderPosition()
				redrawGrid()
			}
		}
	})

	k.onKeyPress("down", () => {
		if (k.isKeyDown("shift")) {
			const newHeight = Math.min(30, editorState.gridSize.height + 1)
			setGridSize(editorState.gridSize.width, newHeight)
			updateSizeLabel()
		} else if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			// Navigate to layer below
			if (editorState.grid && editorState.currentLayer > 0) {
				switchToLayer(editorState.currentLayer - 1)
				updateLayerLabel()
				updateLayerToggles()
				updateBrightnessSliderPosition()
				redrawGrid()
			}
		}
	})

	k.onKeyPress("r", () => {
		resizeGrid()
		updateLayerLabel()
	})

	// Save/Load shortcuts
	k.onKeyPress("s", () => {
		if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			savePattern()
		}
	})

	// Exit with Escape
	k.onKeyPress("escape", () => {
		changeGameState(GameState.MainMenu)
	})
}
