import { k } from "../../main";
import { changeGameState, GameState } from "../../main";
import { CellType } from "../../grid/hexGrid";
import { editorState, setCurrentTool, setGridSize } from "../state/editorState";
import { resizeGrid } from "../actions/gridActions";
import { savePattern } from "../actions/patternActions";
import { switchToLayer } from "../actions/layerActions";
import { redrawGrid } from "../rendering/gridRenderer";
import {
	updateToolLabel,
	updateSizeLabel,
	updateLayerLabel,
	updateLayerToggles,
} from "../ui/StatusBar";
import { uiState } from "../../ui/uiState";

/**
 * Setup editor keyboard controls
 */
export function setupKeyboardControls(): void {
	// Tool selection hotkeys
	k.onKeyPress("e", () => {
		if (uiState.modalOpen) return;
		setCurrentTool(CellType.Empty);
		updateToolLabel();
	});

	k.onKeyPress("w", () => {
		if (uiState.modalOpen) return;
		setCurrentTool(CellType.Wall);
		updateToolLabel();
	});

	k.onKeyPress("o", () => {
		if (uiState.modalOpen) return;
		setCurrentTool(CellType.Obstacle);
		updateToolLabel();
	});

	k.onKeyPress("s", () => {
		if (uiState.modalOpen) return;
		setCurrentTool("spawn");
		updateToolLabel();
	});

	// Layer switching with [ and ]
	k.onKeyPress("[", () => {
		if (uiState.modalOpen) return;
		if (editorState.grid && editorState.currentLayer > 0) {
			switchToLayer(editorState.currentLayer - 1);
			updateLayerLabel();
			updateLayerToggles();
			redrawGrid();
		}
	});

	k.onKeyPress("]", () => {
		if (uiState.modalOpen) return;
		if (
			editorState.grid &&
			editorState.currentLayer < editorState.grid.layers - 1
		) {
			switchToLayer(editorState.currentLayer + 1);
			updateLayerLabel();
			updateLayerToggles();
			redrawGrid();
		}
	});

	// Layer switching with Tab (cycles through all layers)
	k.onKeyPress("tab", () => {
		if (uiState.modalOpen) return;
		if (!editorState.grid) return;
		const nextLayer = (editorState.currentLayer + 1) % editorState.grid.layers;
		switchToLayer(nextLayer);
		updateLayerLabel();
		updateLayerToggles();
		redrawGrid();
	});

	// Grid size controls with shift+arrow keys
	k.onKeyPress("left", () => {
		if (uiState.modalOpen) return;
		if (k.isKeyDown("shift")) {
			const newWidth = Math.max(5, editorState.gridSize.width - 1);
			setGridSize(newWidth, editorState.gridSize.height);
			updateSizeLabel();
		}
	});

	k.onKeyPress("right", () => {
		if (uiState.modalOpen) return;
		if (k.isKeyDown("shift")) {
			const newWidth = Math.min(30, editorState.gridSize.width + 1);
			setGridSize(newWidth, editorState.gridSize.height);
			updateSizeLabel();
		}
	});

	k.onKeyPress("up", () => {
		if (uiState.modalOpen) return;
		if (k.isKeyDown("shift")) {
			const newHeight = Math.max(5, editorState.gridSize.height - 1);
			setGridSize(editorState.gridSize.width, newHeight);
			updateSizeLabel();
		} else if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			// Navigate to layer above
			if (
				editorState.grid &&
				editorState.currentLayer < editorState.grid.layers - 1
			) {
				switchToLayer(editorState.currentLayer + 1);
				updateLayerLabel();
				updateLayerToggles();
				redrawGrid();
			}
		}
	});

	k.onKeyPress("down", () => {
		if (uiState.modalOpen) return;
		if (k.isKeyDown("shift")) {
			const newHeight = Math.min(30, editorState.gridSize.height + 1);
			setGridSize(editorState.gridSize.width, newHeight);
			updateSizeLabel();
		} else if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			// Navigate to layer below
			if (editorState.grid && editorState.currentLayer > 0) {
				switchToLayer(editorState.currentLayer - 1);
				updateLayerLabel();
				updateLayerToggles();
				redrawGrid();
			}
		}
	});

	k.onKeyPress("r", () => {
		if (uiState.modalOpen) return;
		resizeGrid();
		updateLayerLabel();
	});

	// Save/Load shortcuts
	k.onKeyPress("s", () => {
		if (uiState.modalOpen) return;
		if (k.isKeyDown("control") || k.isKeyDown("meta")) {
			savePattern();
		}
	});

	// Exit with Escape
	k.onKeyPress("escape", () => {
		if (uiState.modalOpen) return;
		changeGameState(GameState.MainMenu);
	});
}
