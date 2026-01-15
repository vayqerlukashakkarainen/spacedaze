import { GenerationMap, CaveGenConfig } from "../generationTypes";
import { hexDistance } from "../hexUtils";
import { SeededRNG } from "../seededRng";

/**
 * Pass 7: Feature tagging
 * Tags cells for gameplay purposes (spawns, resources, hazards)
 */
export function applyFeatureTagging(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	const { resourceNodeCount, hazardCount, minPoiSpacing } = config.features;

	// Find all empty cells in main region (largest regionId)
	const mainRegion = findMainRegion(map);
	const emptyCells = map
		.getAllCells()
		.filter(
			(c) => !c.solid && c.regionId === mainRegion && !c.tags.has("tunnel")
		);

	if (emptyCells.length === 0) return;

	// Tag player spawn (center-ish of map)
	tagPlayerSpawn(map, emptyCells, rng);

	// Tag resource nodes
	const resourceCells = placeFeatures(
		emptyCells,
		resourceNodeCount,
		minPoiSpacing,
		rng
	);
	for (const cell of resourceCells) {
		cell.tags.add("resource_node");
	}

	// Tag hazards
	const hazardCells = placeFeatures(
		emptyCells,
		hazardCount,
		minPoiSpacing,
		rng
	);
	for (const cell of hazardCells) {
		cell.tags.add("hazard");
	}

	// Tag points of interest
	const poiCells = [...resourceCells, ...hazardCells];
	for (const cell of poiCells) {
		cell.tags.add("poi_candidate");
	}
}

/**
 * Find main region ID (largest region)
 */
function findMainRegion(map: GenerationMap): number {
	const regionSizes = new Map<number, number>();

	for (const cell of map.getAllCells()) {
		if (!cell.solid && cell.regionId >= 0) {
			regionSizes.set(cell.regionId, (regionSizes.get(cell.regionId) || 0) + 1);
		}
	}

	let largestRegion = 0;
	let largestSize = 0;

	for (const [regionId, size] of regionSizes.entries()) {
		if (size > largestSize) {
			largestSize = size;
			largestRegion = regionId;
		}
	}

	return largestRegion;
}

/**
 * Tag player spawn location
 */
function tagPlayerSpawn(
	map: GenerationMap,
	candidates: any[],
	rng: SeededRNG
): void {
	// Find cell closest to center
	const centerQ = map.width / 2;
	const centerR = map.height / 2;

	let closest = candidates[0];
	let minDist = Infinity;

	for (const cell of candidates) {
		const dist = Math.sqrt(
			Math.pow(cell.coord.q - centerQ, 2) + Math.pow(cell.coord.r - centerR, 2)
		);
		if (dist < minDist) {
			minDist = dist;
			closest = cell;
		}
	}

	if (closest) {
		closest.tags.add("player_spawn");
	}
}

/**
 * Place features with minimum spacing
 */
function placeFeatures(
	candidates: any[],
	count: number,
	minSpacing: number,
	rng: SeededRNG
): any[] {
	const placed: any[] = [];
	const shuffled = [...candidates];
	rng.shuffle(shuffled);

	for (const cell of shuffled) {
		if (placed.length >= count) break;

		// Check spacing from existing placed features
		const tooClose = placed.some(
			(p) => hexDistance(cell.coord, p.coord) < minSpacing
		);
		if (tooClose) continue;

		// Avoid player spawn
		if (cell.tags.has("player_spawn")) continue;

		placed.push(cell);
	}

	return placed;
}
