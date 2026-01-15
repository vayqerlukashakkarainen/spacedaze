import { HexGrid, CellType } from "../grid/hexGrid";
import { GenerationMap } from "./generationTypes";
import { hexCoord } from "../grid/hexCoord";

/**
 * Convert GenerationMap to HexGrid for gameplay
 */
export function generationMapToHexGrid(
	map: GenerationMap,
	hexSize: number,
	offsetX: number = 0,
	offsetY: number = 0
): HexGrid {
	const grid = new HexGrid({
		width: map.width,
		height: map.height,
		hexSize,
		offset: { x: offsetX, y: offsetY },
	});

	// Convert each generated cell to grid cell
	for (const genCell of map.getAllCells()) {
		if (genCell.solid) {
			grid.setCell(genCell.coord, CellType.Wall);
		}
		// Empty cells remain as CellType.Empty (default)
	}

	return grid;
}

/**
 * Get cell data from generation map for gameplay integration
 */
export interface CellGameplayData {
	coord: { q: number; r: number };
	isWall: boolean;
	hardness: number;
	density: number;
	tags: string[];
}

export function getCellGameplayData(map: GenerationMap): CellGameplayData[] {
	return map.getAllCells().map((cell) => ({
		coord: cell.coord,
		isWall: cell.solid,
		hardness: cell.hardness,
		density: cell.density,
		tags: Array.from(cell.tags),
	}));
}
