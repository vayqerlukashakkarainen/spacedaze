import { Vec2 } from "kaplay";
import { k } from "../../main";
import { HexGrid, CellType, HexCell } from "../../grid/hexGrid";
import { HexCoord, hexKey } from "../../grid/hexCoord";
import { editorState } from "../state/editorState";
import { drawWallCell, getHexCenter } from "./wallRenderer";
import { tags } from "../../tags";

/**
 * Tracks which cells are currently rendered
 */
const renderedCells = new Set<string>();

/**
 * Get the visible hex bounds based on camera position and zoom
 */
export function getVisibleHexBounds(grid: HexGrid): {
	minQ: number;
	maxQ: number;
	minR: number;
	maxR: number;
} {
	const camPos = k.getCamPos();
	const camScale = k.getCamScale();
	const screenWidth = k.width();
	const screenHeight = k.height();

	// Calculate the four corners of the viewport in world space
	const corners = [
		// Top-left
		k.vec2(
			camPos.x - screenWidth / (2 * camScale.x),
			camPos.y - screenHeight / (2 * camScale.y)
		),
		// Top-right
		k.vec2(
			camPos.x + screenWidth / (2 * camScale.x),
			camPos.y - screenHeight / (2 * camScale.y)
		),
		// Bottom-left
		k.vec2(
			camPos.x - screenWidth / (2 * camScale.x),
			camPos.y + screenHeight / (2 * camScale.y)
		),
		// Bottom-right
		k.vec2(
			camPos.x + screenWidth / (2 * camScale.x),
			camPos.y + screenHeight / (2 * camScale.y)
		),
	];

	// Convert world corners to hex coordinates
	const hexCorners = corners.map((corner) => grid.screenToHex(corner));

	// Find min/max bounds with padding
	const padding = 2; // Add padding to prevent pop-in
	let minQ = Math.floor(Math.min(...hexCorners.map((h) => h.q))) - padding;
	let maxQ = Math.ceil(Math.max(...hexCorners.map((h) => h.q))) + padding;
	let minR = Math.floor(Math.min(...hexCorners.map((h) => h.r))) - padding;
	let maxR = Math.ceil(Math.max(...hexCorners.map((h) => h.r))) + padding;

	// Clamp to grid bounds
	minQ = Math.max(0, minQ);
	maxQ = Math.min(grid.config.width - 1, maxQ);
	minR = Math.max(0, minR);
	maxR = Math.min(grid.config.height - 1, maxR);

	return { minQ, maxQ, minR, maxR };
}

/**
 * Get set of hex coordinates that should be visible
 */
function getVisibleHexSet(grid: HexGrid): Set<string> {
	const bounds = getVisibleHexBounds(grid);
	const visible = new Set<string>();

	// Iterate through all visible hex coordinates
	for (let q = bounds.minQ; q <= bounds.maxQ; q++) {
		for (let r = bounds.minR; r <= bounds.maxR; r++) {
			for (let layer = 0; layer < grid.layers; layer++) {
				// Skip if layer is not visible
				if (!editorState.layers[layer]?.isVisible) continue;

				const key = hexKey({ q, r }, layer);
				const cell = grid.cells.get(key);

				// Only add cells that actually exist in the grid
				if (cell) {
					visible.add(key);
				}
			}
		}
	}

	return visible;
}

/**
 * Render a single hex cell
 */
function renderCell(cell: HexCell, grid: HexGrid): void {
	const corners = grid.getHexScreenCorners(cell.coord);

	if (cell.type === CellType.Wall) {
		drawWallCell(corners, cell, grid, 1);
	} else if (cell.type === CellType.Obstacle) {
		const center = getHexCenter(corners);
		const relativeCorners = corners.map((corner) =>
			k.vec2(corner.x - center.x, corner.y - center.y)
		);
		k.add([
			k.pos(center),
			k.polygon(relativeCorners),
			k.color(cell.color.r, cell.color.g, cell.color.b),
			k.opacity(1),
			"levelEditor",
			"gridCell",
			{
				hexCoord: cell.coord,
				layer: cell.layer,
			},
		]);
	}
}

/**
 * Update visible cells based on camera position
 * Call this every frame or when camera moves
 */
export function updateVisibleCells(grid: HexGrid): void {
	if (!grid) return;

	const visibleSet = getVisibleHexSet(grid);

	// Find cells to add (newly visible)
	const toAdd: HexCell[] = [];
	for (const key of visibleSet) {
		if (!renderedCells.has(key)) {
			const cell = grid.cells.get(key);
			if (cell) {
				toAdd.push(cell);
			}
		}
	}

	// Find cells to remove (no longer visible)
	const toRemove: string[] = [];
	for (const key of renderedCells) {
		if (!visibleSet.has(key)) {
			toRemove.push(key);
		}
	}

	// Remove cells that are no longer visible
	if (toRemove.length > 0) {
		k.get("gridCell").forEach((obj: any) => {
			if (obj.hexCoord && obj.layer !== undefined) {
				const key = hexKey(obj.hexCoord, obj.layer);
				if (toRemove.includes(key)) {
					obj.destroy();
					renderedCells.delete(key);
				}
			}
		});
	}

	// Add newly visible cells
	for (const cell of toAdd) {
		renderCell(cell, grid);
		renderedCells.add(hexKey(cell.coord, cell.layer));
	}
}

/**
 * Clear all rendered cells
 */
export function clearRenderedCells(): void {
	k.destroyAll("gridCell");
	renderedCells.clear();
}

/**
 * Force full redraw of visible cells
 */
export function redrawVisibleCells(grid: HexGrid): void {
	clearRenderedCells();
	if (grid) {
		updateVisibleCells(grid);
		drawSpawnMarkers();
	}
}

/**
 * Draw markers for spawn placements
 */
function drawSpawnMarkers(): void {
	// Clear old spawn markers
	k.destroyAll("spawnMarker");

	// Draw new spawn markers
	for (const spawn of editorState.spawn.placements) {
		// Draw a cross marker
		const color = k.Color.fromHex("#00ff00");

		// Create clickable area for the spawn
		const clickArea = k.add([
			k.pos(spawn.pos),
			k.circle(12),
			k.area(),
			k.anchor("center"),
			k.opacity(0.01), // Nearly invisible but clickable
			tags.levelEditor,
			"spawnMarker",
			"spawnClickable",
			{
				spawnId: spawn.id,
			},
		]);

		// Circle outline
		k.add([
			k.pos(spawn.pos),
			k.circle(8),
			k.color(color),
			k.anchor("center"),
			k.opacity(0.6),
			k.outline(2, color),
			tags.levelEditor,
			"spawnMarker",
		]);

		// Label showing spawn type
		k.add([
			k.pos(spawn.pos.add(0, -15)),
			k.text(spawn.type.toUpperCase(), { size: 8, font: "unscii" }),
			k.color(color),
			k.anchor("center"),
			k.opacity(0.9),
			tags.levelEditor,
			"spawnMarker",
		]);
	}
}
