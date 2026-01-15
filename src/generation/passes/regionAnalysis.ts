import { GenerationMap, CaveGenConfig } from "../generationTypes";
import { HexCoord, hexNeighbors, hexDistance } from "../hexUtils";
import { SeededRNG } from "../seededRng";

/**
 * Pass 3: Region detection and connectivity
 * Flood-fills empty cells and ensures main cave connectivity
 */
export function applyRegionAnalysis(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	// Step 1: Flood fill to identify regions
	const regions = floodFillRegions(map);

	// Step 2: Find largest region (main cave)
	let largestRegion = 0;
	let largestSize = 0;

	for (const [regionId, size] of regions.entries()) {
		if (size > largestSize) {
			largestSize = size;
			largestRegion = regionId;
		}
	}

	// Step 3: Fill small regions or connect them
	if (config.connectivity.ensureConnected) {
		for (const [regionId, size] of regions.entries()) {
			if (regionId === largestRegion) continue;

			if (size < config.connectivity.minRegionSize) {
				// Fill small regions
				fillRegion(map, regionId);
			} else {
				// Connect to main region
				connectRegions(
					map,
					regionId,
					largestRegion,
					config.connectivity.tunnelWidth
				);
			}
		}
	}
}

/**
 * Flood fill empty cells to assign region IDs
 */
function floodFillRegions(map: GenerationMap): Map<number, number> {
	const regions = new Map<number, number>(); // regionId -> cell count
	let currentRegionId = 0;

	for (const cell of map.getAllCells()) {
		if (cell.solid || cell.regionId !== -1) continue;

		// Start new region
		const regionSize = floodFillFrom(map, cell.coord, currentRegionId);
		regions.set(currentRegionId, regionSize);
		currentRegionId++;
	}

	return regions;
}

/**
 * Flood fill from a starting coordinate
 */
function floodFillFrom(
	map: GenerationMap,
	start: HexCoord,
	regionId: number
): number {
	const queue: HexCoord[] = [start];
	const visited = new Set<string>();
	let count = 0;

	while (queue.length > 0) {
		const coord = queue.shift()!;
		const key = `${coord.q},${coord.r}`;

		if (visited.has(key)) continue;
		visited.add(key);

		const cell = map.getCell(coord);
		if (!cell || cell.solid || cell.regionId !== -1) continue;

		cell.regionId = regionId;
		count++;

		// Add neighbors to queue
		for (const neighbor of hexNeighbors(coord)) {
			if (map.inBounds(neighbor)) {
				queue.push(neighbor);
			}
		}
	}

	return count;
}

/**
 * Fill all cells in a region (make them solid)
 */
function fillRegion(map: GenerationMap, regionId: number): void {
	for (const cell of map.getAllCells()) {
		if (cell.regionId === regionId) {
			cell.solid = true;
			cell.regionId = -1;
		}
	}
}

/**
 * Carve tunnel between two regions
 */
function connectRegions(
	map: GenerationMap,
	fromRegion: number,
	toRegion: number,
	tunnelWidth: number
): void {
	// Find cells from each region
	const fromCells = map.getAllCells().filter((c) => c.regionId === fromRegion);
	const toCells = map.getAllCells().filter((c) => c.regionId === toRegion);

	if (fromCells.length === 0 || toCells.length === 0) return;

	// Find closest pair of cells
	let minDist = Infinity;
	let closestFrom: HexCoord | undefined;
	let closestTo: HexCoord | undefined;

	for (const from of fromCells) {
		for (const to of toCells) {
			const dist = hexDistance(from.coord, to.coord);
			if (dist < minDist) {
				minDist = dist;
				closestFrom = from.coord;
				closestTo = to.coord;
			}
		}
	}

	if (!closestFrom || !closestTo) return;

	// Carve straight-line tunnel
	carveTunnel(map, closestFrom, closestTo, tunnelWidth, toRegion);
}

/**
 * Carve a straight tunnel between two points
 */
function carveTunnel(
	map: GenerationMap,
	from: HexCoord,
	to: HexCoord,
	width: number,
	regionId: number
): void {
	// Simple linear interpolation in hex space
	const steps = hexDistance(from, to);

	for (let i = 0; i <= steps; i++) {
		const t = steps === 0 ? 0 : i / steps;
		const q = Math.round(from.q + (to.q - from.q) * t);
		const r = Math.round(from.r + (to.r - from.r) * t);
		const coord = { q, r };

		// Carve main path
		carveCell(map, coord, regionId);

		// Carve width
		if (width > 1) {
			for (const neighbor of hexNeighbors(coord)) {
				if (map.inBounds(neighbor)) {
					carveCell(map, neighbor, regionId);
				}
			}
		}
	}
}

/**
 * Carve a single cell (make empty, tag as tunnel)
 */
function carveCell(
	map: GenerationMap,
	coord: HexCoord,
	regionId: number
): void {
	const cell = map.getCell(coord);
	if (!cell || cell.locked) return;

	cell.solid = false;
	cell.regionId = regionId;
	cell.tags.add("tunnel");
}
