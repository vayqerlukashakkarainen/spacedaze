/**
 * Integration example: Using cave generator with game's HexGrid
 *
 * This shows how to use the generated cave data in your game.
 */

import { generateCave } from "./generation/caveGenerator";
import { HexGrid, CellType } from "./grid/hexGrid";
import { k } from "./main";
import { hexCoord as gameHexCoord } from "./grid/hexCoord";

/**
 * Generate a procedural level using the cave generator
 */
export function createProceduralLevel(
	seed: number,
	width: number,
	height: number
): HexGrid {
	console.log(`🌌 Generating procedural level with seed ${seed}`);

	// Generate cave data
	const generatedMap = generateCave(seed, width, height);

	// Create game grid
	const grid = new HexGrid({
		width,
		height,
		hexSize: 40,
		offset: k.vec2(
			k.width() / 2 - (width * 40) / 2,
			k.height() / 2 - (height * 30) / 2
		),
	});

	// Convert generated data to game grid
	for (const genCell of generatedMap.getAllCells()) {
		if (genCell.solid) {
			grid.setCell(
				gameHexCoord(genCell.coord.q, genCell.coord.r),
				CellType.Wall
			);
		}
		// Empty cells remain as CellType.Empty (default)
	}

	console.log(`✅ Created ${width}x${height} procedural level`);

	// Return metadata about the level for gameplay
	const metadata = {
		seed,
		grid,
		spawnPoint: findSpawnPoint(generatedMap),
		resourceNodes: findResourceNodes(generatedMap),
		hazards: findHazards(generatedMap),
		cellData: createCellDataMap(generatedMap),
	};

	return metadata as any; // Return grid for now, expand as needed
}

/**
 * Find player spawn point from generation data
 */
function findSpawnPoint(map: any) {
	const spawnCell = map
		.getAllCells()
		.find((c: any) => c.tags.has("player_spawn"));
	return spawnCell
		? spawnCell.coord
		: { q: Math.floor(map.width / 2), r: Math.floor(map.height / 2) };
}

/**
 * Find all resource nodes
 */
function findResourceNodes(map: any) {
	return map
		.getAllCells()
		.filter((c: any) => c.tags.has("resource_node"))
		.map((c: any) => c.coord);
}

/**
 * Find all hazard locations
 */
function findHazards(map: any) {
	return map
		.getAllCells()
		.filter((c: any) => c.tags.has("hazard"))
		.map((c: any) => c.coord);
}

/**
 * Create a map of cell data for destructible terrain
 */
function createCellDataMap(map: any) {
	const dataMap = new Map<
		string,
		{ hardness: number; density: number; tags: string[] }
	>();

	for (const cell of map.getAllCells()) {
		if (cell.solid) {
			dataMap.set(`${cell.coord.q},${cell.coord.r}`, {
				hardness: cell.hardness,
				density: cell.density,
				tags: Array.from(cell.tags),
			});
		}
	}

	return dataMap;
}

/**
 * Example: Implement destructible terrain
 */
export function applyCarvingDamage(
	grid: HexGrid,
	cellData: Map<string, any>,
	coord: { q: number; r: number },
	damage: number
): boolean {
	const key = `${coord.q},${coord.r}`;
	const data = cellData.get(key);

	if (!data) return false;

	// Apply damage
	data.hardness -= damage;

	// Check if destroyed
	if (data.hardness <= 0) {
		// Remove from grid
		grid.setCell(gameHexCoord(coord.q, coord.r), CellType.Empty);

		// Drop resources based on density
		const resourceAmount = Math.floor(data.density * 10);
		console.log(`💎 Cell destroyed! Dropped ${resourceAmount} resources`);

		// Remove from data map
		cellData.delete(key);

		return true; // Cell was destroyed
	}

	return false; // Cell still solid
}

/**
 * Example usage in level loading
 */
export function loadProceduralLevel() {
	const seed = Date.now(); // Or use a fixed seed for reproducible levels
	const grid = createProceduralLevel(seed, 50, 40);

	// The grid is now ready to use in your game
	// You can spawn entities, render it, etc.

	return grid;
}
