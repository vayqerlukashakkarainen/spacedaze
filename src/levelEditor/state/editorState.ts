import { Vec2 } from "kaplay"
import { k } from "../../main"
import { HexGrid, CellType } from "../../grid/hexGrid"
import { HexCoord } from "../../grid/hexCoord"

/**
 * Layer state for visibility and brightness
 */
export interface LayerState {
	isVisible: boolean
	brightness: number
}

/**
 * Centralized editor state
 */
export interface EditorState {
	grid: HexGrid | undefined
	currentTool: CellType
	currentLayer: number
	gridSize: {
		width: number
		height: number
	}
	camera: {
		offset: Vec2
		targetOffset: Vec2
		zoom: number
		targetZoom: number
		moveSpeed: number
	}
	layers: LayerState[]
	hoveredCell: HexCoord | undefined
	mouse: {
		isDown: boolean
		isRightDown: boolean
	}
	ui: {
		showOutlines: boolean
		brightnessSlider: any
		layerToggleButtons: any[]
	}
}

/**
 * Global editor state instance
 */
export const editorState: EditorState = {
	grid: undefined,
	currentTool: CellType.Wall,
	currentLayer: 0,
	gridSize: {
		width: 15,
		height: 15,
	},
	camera: {
		offset: k.vec2(0, 0),
		targetOffset: k.vec2(0, 0),
		zoom: 1,
		targetZoom: 1,
		moveSpeed: 300,
	},
	layers: [{ isVisible: true, brightness: 1.0 }],
	hoveredCell: undefined,
	mouse: {
		isDown: false,
		isRightDown: false,
	},
	ui: {
		showOutlines: true,
		brightnessSlider: undefined,
		layerToggleButtons: [],
	},
}

/**
 * Reset editor state to initial values
 */
export function resetEditorState(): void {
	editorState.grid = undefined
	editorState.currentTool = CellType.Wall
	editorState.currentLayer = 0
	editorState.gridSize.width = 15
	editorState.gridSize.height = 15
	editorState.camera.offset = k.vec2(0, 0)
	editorState.camera.targetOffset = k.vec2(0, 0)
	editorState.camera.zoom = 1
	editorState.camera.targetZoom = 1
	editorState.layers = [{ isVisible: true, brightness: 1.0 }]
	editorState.hoveredCell = undefined
	editorState.mouse.isDown = false
	editorState.mouse.isRightDown = false
	editorState.ui.showOutlines = true
	editorState.ui.brightnessSlider = undefined
	editorState.ui.layerToggleButtons = []
}

/**
 * Get current grid
 */
export function getGrid(): HexGrid | undefined {
	return editorState.grid
}

/**
 * Set current tool
 */
export function setCurrentTool(tool: CellType): void {
	editorState.currentTool = tool
}

/**
 * Get current tool
 */
export function getCurrentTool(): CellType {
	return editorState.currentTool
}

/**
 * Set current layer
 */
export function setCurrentLayer(layer: number): void {
	editorState.currentLayer = layer
	if (editorState.grid) {
		editorState.grid.setCurrentLayer(layer)
	}
}

/**
 * Get current layer
 */
export function getCurrentLayer(): number {
	return editorState.currentLayer
}

/**
 * Get grid size
 */
export function getGridSize(): { width: number; height: number } {
	return editorState.gridSize
}

/**
 * Set grid size (does not resize grid, just updates state)
 */
export function setGridSize(width: number, height: number): void {
	editorState.gridSize.width = width
	editorState.gridSize.height = height
}
