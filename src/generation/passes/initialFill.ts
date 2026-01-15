import { GenerationMap, GenCell, CaveGenConfig } from "../generationTypes";
import { SeededRNG } from "../seededRng";
import { hexCoord } from "../hexUtils";

/**
 * Pass 1: Initial random fill
 * Creates random distribution of solid/empty cells
 */
export function applyInitialFill(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	const { percentage, edgesSolid } = config.fill;

	for (let q = 0; q < map.width; q++) {
		for (let r = 0; r < map.height; r++) {
			const coord = hexCoord(q, r);
			const isEdge =
				q === 0 || q === map.width - 1 || r === 0 || r === map.height - 1;

			// Force edges solid if configured
			const solid = edgesSolid && isEdge ? true : rng.nextBool(percentage);

			const cell: GenCell = {
				coord,
				solid,
				hardness: 1.0,
				density: 1.0,
				regionId: -1,
				tags: new Set(),
				locked: false,
			};

			map.setCell(coord, cell);
		}
	}
}
