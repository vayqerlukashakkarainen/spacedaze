#!/usr/bin/env node

/**
 * Test script for cave generator
 * Run with: npx tsx src/generation/test/testGenerator.ts
 */

import { generateCave } from "../caveGenerator";
import {
	renderASCII,
	getStatistics,
	exportJSON,
	exportSVG,
} from "../debug/visualizer";
import * as fs from "fs";
import * as path from "path";

// Create output directory
const outputDir = path.join(process.cwd(), "generated");
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, { recursive: true });
}

console.log("🌌 SpaceDaze Cave Generator Test\n");

// Test different seeds
const seeds = [12345, 67890, 99999];
const width = 40;
const height = 30;

for (const seed of seeds) {
	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`Seed: ${seed}`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

	// Generate map
	const startTime = Date.now();
	const map = generateCave(seed, width, height);
	const elapsed = Date.now() - startTime;

	console.log(`\n⏱️  Generated in ${elapsed}ms\n`);

	// ASCII visualization
	console.log("ASCII Preview (first 20 rows):");
	const ascii = renderASCII(map);
	console.log(ascii.split("\n").slice(0, 20).join("\n"));
	console.log("...\n");

	// Statistics
	console.log(getStatistics(map));

	// Export files
	const prefix = `cave_${seed}`;
	exportJSON(map, path.join(outputDir, `${prefix}.json`));
	exportSVG(map, path.join(outputDir, `${prefix}.svg`));

	console.log(`\n✅ Files saved to ${outputDir}/`);
}

console.log("\n🎉 All tests complete!");
console.log("\nGenerated files:");
console.log("  - cave_*.json - Full cell data");
console.log("  - cave_*.svg  - Visual preview (open in browser)\n");

console.log("Legend:");
console.log("  █▓▒░ - Solid cells (hardness)");
console.log("  P - Player spawn");
console.log("  R - Resource node");
console.log("  H - Hazard");
console.log("  · - Tunnel");
console.log("  ○ - Chamber");
console.log("  L - Locked cell\n");
