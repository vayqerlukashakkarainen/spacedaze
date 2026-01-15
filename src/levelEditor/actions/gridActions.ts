import { k } from "../../main";
import { HexGrid } from "../../grid/hexGrid";
import { hexCoord } from "../../grid/hexCoord";
import { CellType } from "../../grid/hexGrid";
import { editorState } from "../state/editorState";
import { redrawGrid } from "../rendering/gridRenderer";
import { gridToPattern } from "../editorPatterns";
import { gridRegistry } from "../../grid/gridRegistry";
import { CaveGenerator } from "../../generation/caveGenerator";
import { generationMapToHexGrid } from "../../generation/gridConversion";
import { exportPNG } from "../../generation/debug/visualizer";
import { createInputModal, createListModal, createModal } from "../ui/Modal";

/**
 * Paint current cell with selected tool
 */
export function paintCell(): void {
	if (!editorState.grid || !editorState.hoveredCell) return;

	editorState.grid.setCell(editorState.hoveredCell, editorState.currentTool);
	redrawGrid();
}

/**
 * Clear current cell (set to empty)
 */
export function clearCell(): void {
	if (!editorState.grid || !editorState.hoveredCell) return;

	editorState.grid.setCell(editorState.hoveredCell, CellType.Empty);
	redrawGrid();
}

/**
 * Clear entire grid
 */
export function clearGrid(): void {
	if (!editorState.grid) return;

	editorState.grid.generateEmpty();
	redrawGrid();
	console.log("Grid cleared");
}

/**
 * Generate procedural cave and apply to grid
 */
export function generateCave(seed: number | undefined): void {
	if (!editorState.grid) return;

	// Use random seed if none provided
	const finalSeed =
		seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
	console.log(`🌌 Generating cave with seed: ${finalSeed}`);

	// Generate cave data
	const generator = new CaveGenerator(finalSeed);
	const generationMap = generator.generate(
		editorState.grid.config.width,
		editorState.grid.config.height
	);

	// Convert to HexGrid
	const newGrid = generationMapToHexGrid(
		generationMap,
		editorState.grid.config.hexSize,
		editorState.grid.config.offset.x,
		editorState.grid.config.offset.y
	);

	// Copy layer settings
	newGrid.setCurrentLayer(editorState.grid.currentLayer);

	// Replace current grid
	editorState.grid = newGrid;
	gridRegistry.register("editor", newGrid);

	// Redraw
	redrawGrid();

	// Export PNG for debugging
	exportPNG(generationMap, `cave_seed_${finalSeed}.png`, 20);

	console.log(`✅ Cave generation complete`);
}

/**
 * Resize grid to new dimensions
 */
export function resizeGrid(): void {
	if (!editorState.grid) return;

	// Save current pattern
	const oldPattern = gridToPattern(editorState.grid, "temp");
	const oldLayers = editorState.grid.layers;

	// Create new grid with same number of layers
	const center = k.center();
	editorState.grid = new HexGrid(
		{
			width: editorState.gridSize.width,
			height: editorState.gridSize.height,
			hexSize: 30,
			offset: k.vec2(center.x - 300, center.y - 200),
		},
		oldLayers
	);
	editorState.grid.setCurrentLayer(editorState.currentLayer);
	gridRegistry.register("editor", editorState.grid);

	// Try to restore pattern if it fits
	if (
		oldPattern.width <= editorState.gridSize.width &&
		oldPattern.height <= editorState.gridSize.height
	) {
		for (const [coordStr, cellType] of Object.entries(oldPattern.cells)) {
			const [q, r] = coordStr.split(",").map(Number);
			editorState.grid.setCell(
				hexCoord(q, r),
				cellType,
				editorState.currentLayer
			);
		}
	}

	redrawGrid();
	console.log(
		`Grid resized to ${editorState.gridSize.width}x${editorState.gridSize.height}`
	);
}

/**
 * Update hovered cell based on mouse position
 */
export function updateHoveredCell(): void {
	if (!editorState.grid) return;

	// Convert mouse screen position to world position (accounting for camera offset and zoom)
	const mouseScreenPos = k.mousePos();
	const camPos = k.getCamPos();
	const camScale = k.getCamScale();

	// Account for zoom when converting screen to world coordinates
	const worldPos = k.vec2(
		(mouseScreenPos.x - k.width() / 2) / camScale.x + camPos.x,
		(mouseScreenPos.y - k.height() / 2) / camScale.y + camPos.y
	);
	const hexCoordResult = editorState.grid.screenToHex(worldPos);

	if (editorState.grid.inBounds(hexCoordResult)) {
		editorState.hoveredCell = hexCoordResult;

		// Highlight hovered cell
		k.destroyAll("hover");
		const corners = editorState.grid.getHexScreenCorners(hexCoordResult);
		k.add([
			k.polygon(corners),
			k.outline(2, new k.Color(255, 255, 0)),
			k.opacity(0),
			"levelEditor",
			"hover",
		]);
	} else {
		editorState.hoveredCell = undefined;
		k.destroyAll("hover");
	}
}

/**
 * Save grid to JSON file in /maps directory
 */
export function saveGridToFile(): void {
	if (!editorState.grid) return;

	createInputModal("Save Map", "map_name", async (filename) => {
		const pattern = gridToPattern(editorState.grid!, filename);
		const json = JSON.stringify(pattern, null, 2);

		try {
			// Download as JSON file
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${filename}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			console.log(`✅ Map "${filename}" saved to downloads`);
			createModal("Success", `Map "${filename}.json" saved!`, [
				{ text: "OK", onClick: () => {} },
			]);
		} catch (error) {
			console.error("Failed to save map:", error);
			createModal("Error", "Failed to save map file", [
				{ text: "OK", onClick: () => {} },
			]);
		}
	});
}

/**
 * Load grid from JSON file
 */
export function loadGridFromFile(): void {
	if (!editorState.grid) return;

	// Create file input element
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";
	input.style.display = "none";

	input.onchange = async (e: any) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const pattern = JSON.parse(text);

			// Validate pattern structure
			if (!pattern.name || !pattern.cells) {
				throw new Error("Invalid map file format");
			}

			// Clear and load pattern
			clearGrid();

			for (const [coordStr, cellType] of Object.entries(pattern.cells)) {
				const [q, r] = coordStr.split(",").map(Number);
				const coord = hexCoord(q, r);
				if (editorState.grid!.inBounds(coord)) {
					editorState.grid!.setCell(coord, cellType as CellType);
				}
			}

			redrawGrid();
			console.log(`✅ Map "${pattern.name}" loaded!`);
			createModal("Success", `Map "${pattern.name}" loaded!`, [
				{ text: "OK", onClick: () => {} },
			]);
		} catch (error) {
			console.error("Failed to load map:", error);
			createModal("Error", "Failed to load map file", [
				{ text: "OK", onClick: () => {} },
			]);
		}

		document.body.removeChild(input);
	};

	document.body.appendChild(input);
	input.click();
}
