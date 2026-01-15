import { k } from "../main";
import { HexGrid } from "../grid/hexGrid";
import { gridRegistry } from "../grid/gridRegistry";
import { editorState, resetEditorState } from "./state/editorState";
import { drawGrid } from "./rendering/gridRenderer";
import { updateVisibleCells, redrawVisibleCells } from "./rendering/hexCulling";
import { setupKeyboardControls } from "./controls/keyboardControls";
import { setupMouseControls } from "./controls/mouseControls";
import { setupCameraControls, updateCamera } from "./controls/cameraControls";
import {
	createStatusBar,
	createBrightnessSlider,
	updateZoomLabel,
} from "./ui/StatusBar";
import { createToolPalette } from "./ui/ToolPalette";
import { createActionBar } from "./ui/ActionBar";
import { createLayerBar } from "./ui/LayerBar";

/**
 * Enter level editor mode
 */
export function enterLevelEditor(): void {
	// Reset state
	resetEditorState();

	// Create editor grid with 1 layer by default
	const center = k.center();
	editorState.camera.offset = k.vec2(0, 0);
	editorState.camera.targetOffset = k.vec2(0, 0);
	editorState.camera.zoom = 1;
	editorState.camera.targetZoom = 1;

	editorState.grid = new HexGrid(
		{
			width: editorState.gridSize.width,
			height: editorState.gridSize.height,
			hexSize: 64,
			offset: k.vec2(center.x - 300, center.y - 200),
		},
		1
	);
	gridRegistry.register("editor", editorState.grid);

	// Create UI components
	const screenWidth = k.width();
	const screenHeight = k.height();
	const paletteX = screenWidth - 150;

	createLayerBar();
	createBrightnessSlider();

	const paletteY = createToolPalette(paletteX, 80);
	createActionBar(paletteX, paletteY, screenHeight);

	createStatusBar();

	// Draw grid using efficient culling
	redrawVisibleCells(editorState.grid);

	// Setup controls
	setupKeyboardControls();
	setupMouseControls();
	setupCameraControls();
}

/**
 * Exit level editor and cleanup
 */
export function exitLevelEditor(): void {
	k.destroyAll("levelEditor");
	gridRegistry.unregister("editor");
	resetEditorState();
	k.setCamPos(k.center());
}

/**
 * Update loop for level editor
 */
export function updateLevelEditor(): void {
	updateCamera(k.dt());
	updateZoomLabel();

	// Update visible cells based on camera position
	if (editorState.grid) {
		updateVisibleCells(editorState.grid);
	}
}
