/**
 * Example usage of cave generator in game context
 */

import { generateCave, CaveGenerator } from "./caveGenerator";
import { generationMapToHexGrid, getCellGameplayData } from "./gridConversion";
import { CaveGenConfig } from "./generationTypes";

// Example 1: Quick generation with defaults
export function exampleQuickGeneration() {
	const seed = 12345;
	const map = generateCave(seed, 30, 20);

	// Convert to HexGrid for rendering
	const grid = generationMapToHexGrid(map, 40, 400, 300);

	return grid;
}

// Example 2: Custom configuration
export function exampleCustomConfig() {
	const customConfig: Partial<CaveGenConfig> = {
		fill: {
			percentage: 0.55, // More dense
			edgesSolid: true,
		},
		ca: {
			iterations: 6, // More smoothing
			birthThreshold: 5,
			survivalThreshold: 4,
		},
		stamps: {
			enabled: true,
			count: 5, // More structures
			minSpacing: 10,
		},
	};

	const generator = new CaveGenerator(67890, customConfig);
	const map = generator.generate(50, 40);

	return generationMapToHexGrid(map, 30);
}

// Example 3: Using gameplay data for destructible terrain
export function exampleGameplayIntegration() {
	const seed = 99999;
	const map = generateCave(seed, 25, 25);

	// Get gameplay data for each cell
	const cellData = getCellGameplayData(map);

	// Example: Apply carving damage to a cell
	const targetCell = cellData.find((c) => c.tags.includes("resource_node"));
	if (targetCell) {
		console.log(
			`Mining resource at (${targetCell.coord.q}, ${targetCell.coord.r})`
		);
		console.log(`Hardness: ${targetCell.hardness}`);
		console.log(`Density: ${targetCell.density}`);

		// In gameplay, reduce hardness until cell is destroyed
		// Then update the grid by setting cell to empty
	}

	return { map, cellData };
}

// Example 4: Multiple layers for 3D caves
export function exampleMultiLayer() {
	const seed = 11111;

	// Generate multiple layers
	const layers = [];
	for (let layer = 0; layer < 3; layer++) {
		const layerSeed = seed + layer * 1000;
		const map = generateCave(layerSeed, 30, 30, {
			fill: { percentage: 0.45 + layer * 0.05, edgesSolid: true },
		});
		layers.push(map);
	}

	return layers;
}
