import { GenerationMap, CaveGenConfig } from "../generationTypes";
import { hexNeighbors } from "../hexUtils";
import { SeededRNG } from "../seededRng";

/**
 * Pass 6: Material and hardness assignment
 * Assigns hardness and density based on position and neighbors
 */
export function applyMaterialAssignment(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	const { edgeHardnessBonus, depthHardnessScale, baseDensity } =
		config.materials;

	for (const cell of map.getAllCells()) {
		if (!cell.solid || cell.locked) continue;

		// Calculate edge distance (0 at edge, 1 at center)
		const edgeDistQ =
			Math.min(cell.coord.q, map.width - 1 - cell.coord.q) / (map.width / 2);
		const edgeDistR =
			Math.min(cell.coord.r, map.height - 1 - cell.coord.r) / (map.height / 2);
		const edgeDist = Math.min(edgeDistQ, edgeDistR);

		// Edges are harder
		const edgeHardness = (1 - edgeDist) * edgeHardnessBonus;

		// Count empty neighbors (cells near open space are softer)
		const neighbors = hexNeighbors(cell.coord);
		let emptyNeighbors = 0;

		for (const neighborCoord of neighbors) {
			if (!map.inBounds(neighborCoord)) continue;
			const neighbor = map.getCell(neighborCoord);
			if (neighbor && !neighbor.solid) {
				emptyNeighbors++;
			}
		}

		// More empty neighbors = softer (easier to carve)
		const neighborSoftness = (emptyNeighbors / 6) * 0.5;

		// Depth hardness (r coordinate as proxy for depth)
		const depthHardness = (cell.coord.r / map.height) * depthHardnessScale;

		// Combine factors
		cell.hardness = Math.max(
			0.1,
			1.0 + edgeHardness + depthHardness - neighborSoftness
		);
		cell.density = baseDensity * (0.8 + rng.nextFloat() * 0.4);
	}
}
