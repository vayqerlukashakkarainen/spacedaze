import {
	GenerationMap,
	CaveGenConfig,
	CaveGenConfigOverrides,
	resolveCaveGenConfig,
} from "./generationTypes";
import { SeededRNG } from "./seededRng";
import { applyInitialFill } from "./passes/initialFill";
import { applyCellularAutomata } from "./passes/cellularAutomata";
import { applyRegionAnalysis } from "./passes/regionAnalysis";
import { applyStamps } from "./stamps/stampSystem";
import { applyMaterialAssignment } from "./passes/materialAssignment";
import { applyFeatureTagging } from "./passes/featureTagging";

/**
 * Main cave generator - orchestrates multipass pipeline
 */
export class CaveGenerator {
	private rng: SeededRNG;
	private config: CaveGenConfig;

	constructor(seed: number, config: CaveGenConfigOverrides = {}) {
		this.rng = new SeededRNG(seed);
		this.config = resolveCaveGenConfig(config);
	}

	/**
	 * Generate complete cave map
	 */
	generate(width: number, height: number): GenerationMap {
		const map = new GenerationMap(width, height);

		console.log("🌍 Pass 1: Initial Fill");
		applyInitialFill(map, this.rng, this.config);

		console.log("🔄 Pass 2: Cellular Automata");
		applyCellularAutomata(map, this.config);

		console.log("🗺️  Pass 3: Region Analysis");
		applyRegionAnalysis(map, this.rng, this.config);

		console.log("🏛️  Pass 4: Stamp Injection");
		applyStamps(map, this.rng, this.config);

		console.log("⚒️  Pass 5: Material Assignment");
		applyMaterialAssignment(map, this.rng, this.config);

		console.log("🎯 Pass 6: Feature Tagging");
		applyFeatureTagging(map, this.rng, this.config);

		console.log("✅ Generation complete");
		return map;
	}
}

/**
 * Convenience function for one-shot generation
 */
export function generateCave(
	seed: number,
	width: number,
	height: number,
	config?: CaveGenConfigOverrides
): GenerationMap {
	const generator = new CaveGenerator(seed, config);
	return generator.generate(width, height);
}
