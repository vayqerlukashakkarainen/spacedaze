import { GenerationMap, CaveGenConfig } from "../generationTypes";
import { hexNeighbors } from "../hexUtils";

/**
 * Pass 2: Cellular Automata smoothing
 * Applies hex-neighbor CA rules to create organic cave shapes
 */
export function applyCellularAutomata(
	map: GenerationMap,
	config: CaveGenConfig
): void {
	const { iterations, birthThreshold, survivalThreshold } = config.ca;

	for (let i = 0; i < iterations; i++) {
		// Create snapshot of current state
		const snapshot = new Map<string, boolean>();
		for (const cell of map.getAllCells()) {
			snapshot.set(`${cell.coord.q},${cell.coord.r}`, cell.solid);
		}

		// Apply rules to each cell
		for (const cell of map.getAllCells()) {
			if (cell.locked) continue;

			const neighbors = hexNeighbors(cell.coord);
			let solidCount = 0;

			for (const neighborCoord of neighbors) {
				if (!map.inBounds(neighborCoord)) {
					// Out of bounds counts as solid
					solidCount++;
					continue;
				}

				const key = `${neighborCoord.q},${neighborCoord.r}`;
				if (snapshot.get(key)) {
					solidCount++;
				}
			}

			// Apply CA rules
			if (cell.solid) {
				// Survival rule: stay solid if enough neighbors
				cell.solid = solidCount >= survivalThreshold;
			} else {
				// Birth rule: become solid if enough neighbors
				cell.solid = solidCount >= birthThreshold;
			}
		}
	}
}
