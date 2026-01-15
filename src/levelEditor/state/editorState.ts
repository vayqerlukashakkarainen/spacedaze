import { Vec2 } from "kaplay";
import { k } from "../../main";
import { HexGrid, CellType } from "../../grid/hexGrid";
import { HexCoord } from "../../grid/hexCoord";

/**
 * Layer state for visibility and brightness
 */
export interface LayerState {
	isVisible: boolean;
	brightness: number;
}

/**
 * Spawn entity placement data
 */
export interface SpawnPlacement {
	id: number;
	type: string;
	pos: Vec2;
	props?: any;
}

/**
 * Tool types
 */
export type EditorTool = CellType | "spawn";

/**
 * Centralized editor state
 */
export interface EditorState {
	grid: HexGrid | undefined;
	currentTool: EditorTool;
	currentLayer: number;
	spawn: {
		selectedType: string;
		placements: SpawnPlacement[];
	};
	gridSize: {
		width: number;
		height: number;
	};
	camera: {
		offset: Vec2;
		targetOffset: Vec2;
		zoom: number;
		targetZoom: number;
		moveSpeed: number;
	};
	layers: LayerState[];
	hoveredCell: HexCoord | undefined;
	mouse: {
		isDown: boolean;
		isRightDown: boolean;
	};
	ui: {
		showOutlines: boolean;
		brightnessSlider: any;
		layerToggleButtons: any[];
	};
}

/**
 * Global editor state instance
 */
export const editorState: EditorState = {
	grid: undefined,
	currentTool: CellType.Wall,
	currentLayer: 0,
	spawn: {
		selectedType: "crate",
		placements: [],
	},
	gridSize: {
		width: 15,
		height: 15,
	},
	camera: {
		offset: { x: 0, y: 0 } as Vec2,
		targetOffset: { x: 0, y: 0 } as Vec2,
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
};

/**
 * Reset editor state to initial values
 */
export function resetEditorState(): void {
	editorState.grid = undefined;
	editorState.currentTool = CellType.Wall;
	editorState.currentLayer = 0;
	editorState.gridSize.width = 100;
	editorState.gridSize.height = 100;
	editorState.camera.offset = k.vec2(0, 0);
	editorState.camera.targetOffset = k.vec2(0, 0);
	editorState.camera.zoom = 1;
	editorState.camera.targetZoom = 1;
	editorState.layers = [{ isVisible: true, brightness: 1.0 }];
	editorState.hoveredCell = undefined;
	editorState.mouse.isDown = false;
	editorState.mouse.isRightDown = false;
	editorState.ui.showOutlines = true;
	editorState.ui.brightnessSlider = undefined;
	editorState.ui.layerToggleButtons = [];
}

/**
 * Get current grid
 */
export function getGrid(): HexGrid | undefined {
	return editorState.grid;
}

/**
 * Set current editing tool
 */
export function setCurrentTool(tool: EditorTool): void {
	editorState.currentTool = tool;
}

/**
 * Set selected spawn type
 */
export function setSelectedSpawn(spawnType: string): void {
	editorState.spawn.selectedType = spawnType;
}

/**
 * Add spawn placement
 */
let nextSpawnId = 1;
export function addSpawnPlacement(
	pos: Vec2,
	type?: string,
	props?: any
): SpawnPlacement {
	const spawnType = type || editorState.spawn.selectedType;
	const placement: SpawnPlacement = {
		id: nextSpawnId++,
		type: spawnType,
		pos: k.vec2(pos.x, pos.y),
		props,
	};
	editorState.spawn.placements.push(placement);
	return placement;
}

/**
 * Remove spawn placement near position
 */
export function removeSpawnPlacement(pos: Vec2, radius: number = 20): void {
	const index = editorState.spawn.placements.findIndex(
		(p) => p.pos.dist(pos) < radius
	);
	if (index !== -1) {
		editorState.spawn.placements.splice(index, 1);
	}
}

/**
 * Clear all spawn placements
 */
export function clearSpawnPlacements(): void {
	editorState.spawn.placements = [];
}

/**
 * Get spawn placement by ID
 */
export function getSpawnPlacementById(id: number): SpawnPlacement | undefined {
	return editorState.spawn.placements.find((p) => p.id === id);
}

/**
 * Update spawn placement props
 */
export function updateSpawnProps(id: number, props: any): void {
	const spawn = getSpawnPlacementById(id);
	if (spawn) {
		spawn.props = props;
	}
}

/**
 * Get current tool
 */
export function getCurrentTool(): CellType {
	return editorState.currentTool;
}

/**
 * Set current layer
 */
export function setCurrentLayer(layer: number): void {
	editorState.currentLayer = layer;
	if (editorState.grid) {
		editorState.grid.setCurrentLayer(layer);
	}
}

/**
 * Get current layer
 */
export function getCurrentLayer(): number {
	return editorState.currentLayer;
}

/**
 * Get grid size
 */
export function getGridSize(): { width: number; height: number } {
	return editorState.gridSize;
}

/**
 * Set grid size (does not resize grid, just updates state)
 */
export function setGridSize(width: number, height: number): void {
	editorState.gridSize.width = width;
	editorState.gridSize.height = height;
}
