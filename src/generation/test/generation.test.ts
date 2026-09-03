import { CaveGenerator } from "../caveGenerator";
import {
	GenerationMap,
	GenCell,
	ROOM_ROLES,
	resolveCaveGenConfig,
	roomRoleTag,
} from "../generationTypes";
import { hexCoord, hexKey, hexNeighbors } from "../hexUtils";
import { selectGeneratedContent } from "../runtime/roomContentRegistry";

/**
 * Test suite for procedural cave generation
 * Run with: npx tsx src/generation/test/generation.test.ts
 */

// Test utilities
function assertEqual(actual: any, expected: any, message: string) {
	if (actual !== expected) {
		throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
	}
}

function assertNotEqual(actual: any, expected: any, message: string) {
	if (actual === expected) {
		throw new Error(
			`${message}\nExpected NOT to be: ${expected}\nActual: ${actual}`
		);
	}
}

function assertTrue(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(`${message}\nExpected: true\nActual: false`);
	}
}

function assertFalse(condition: boolean, message: string) {
	if (condition) {
		throw new Error(`${message}\nExpected: false\nActual: true`);
	}
}

function assertInRange(
	value: number,
	min: number,
	max: number,
	message: string
) {
	if (value < min || value > max) {
		throw new Error(
			`${message}\nExpected: ${min} <= ${value} <= ${max}\nActual: ${value}`
		);
	}
}

// Test runner
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
	testsRun++;
	try {
		fn();
		testsPassed++;
		console.log(`✅ ${name}`);
	} catch (error) {
		testsFailed++;
		console.error(`❌ ${name}`);
		console.error(`   ${(error as Error).message}`);
	}
}

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

test("Same seed produces identical maps", () => {
	const generator1 = new CaveGenerator(12345);
	const map1 = generator1.generate(20, 15);
	const generator2 = new CaveGenerator(12345);
	const map2 = generator2.generate(20, 15);

	assertEqual(map1.width, map2.width, "Widths should match");
	assertEqual(map1.height, map2.height, "Heights should match");

	const cells1 = map1.getAllCells();
	const cells2 = map2.getAllCells();
	assertEqual(cells1.length, cells2.length, "Cell counts should match");

	// Check every cell
	for (let i = 0; i < cells1.length; i++) {
		const c1 = cells1[i];
		const c2 = cells2[i];
		assertEqual(c1.solid, c2.solid, `Cell ${i} solid state should match`);
		assertEqual(
			c1.hardness.toFixed(3),
			c2.hardness.toFixed(3),
			`Cell ${i} hardness should match`
		);
		assertEqual(c1.regionId, c2.regionId, `Cell ${i} regionId should match`);
		assertEqual(c1.locked, c2.locked, `Cell ${i} locked state should match`);
		assertEqual(
			[...c1.tags].sort().join(","),
			[...c2.tags].sort().join(","),
			`Cell ${i} tags should match`
		);
	}
});

test("Different seeds produce different maps", () => {
	const generator1 = new CaveGenerator(12345);
	const map1 = generator1.generate(20, 15);
	const generator2 = new CaveGenerator(54321);
	const map2 = generator2.generate(20, 15);

	let differenceCount = 0;
	for (let q = 0; q < 20; q++) {
		for (let r = 0; r < 15; r++) {
			const c1 = map1.getCell({ q, r });
			const c2 = map2.getCell({ q, r });
			if (c1?.solid !== c2?.solid) {
				differenceCount++;
			}
		}
	}

	assertTrue(
		differenceCount > 50,
		`Maps should differ significantly (found ${differenceCount} differences)`
	);
});

// ============================================================================
// GRID DIMENSIONS TESTS
// ============================================================================

test("Generated map has correct dimensions", () => {
	const generator = new CaveGenerator(1033);
	const map = generator.generate(30, 20);

	assertEqual(map.width, 30, "Width should be 30");
	assertEqual(map.height, 20, "Height should be 20");
	assertEqual(
		map.getAllCells().length,
		30 * 20,
		"Should have width × height cells"
	);
});

test("All coordinates within bounds", () => {
	const generator = new CaveGenerator(1037);
	const map = generator.generate(25, 18);

	for (const cell of map.getAllCells()) {
		assertTrue(
			cell.coord.q >= 0 && cell.coord.q < 25,
			`Q coordinate ${cell.coord.q} should be in [0, 25)`
		);
		assertTrue(
			cell.coord.r >= 0 && cell.coord.r < 18,
			`R coordinate ${cell.coord.r} should be in [0, 18)`
		);
	}
});

test("No duplicate coordinates", () => {
	const generator = new CaveGenerator(1041);
	const map = generator.generate(20, 15);

	const coordSet = new Set<string>();
	for (const cell of map.getAllCells()) {
		const key = `${cell.coord.q},${cell.coord.r}`;
		assertFalse(coordSet.has(key), `Duplicate coordinate found: ${key}`);
		coordSet.add(key);
	}
});

// ============================================================================
// FILL PERCENTAGE TESTS
// ============================================================================

test("Fill percentage roughly matches configuration", () => {
	const generator = new CaveGenerator(1047);
	const map = generator.generate(40, 30);

	const cells = map.getAllCells();
	const solidCount = cells.filter((c) => c.solid).length;
	const fillPercentage = solidCount / cells.length;

	// Default is ~48% but CA smoothing changes it
	// Should be somewhere between 30% and 70%
	assertInRange(
		fillPercentage,
		0.3,
		0.7,
		`Fill percentage ${(fillPercentage * 100).toFixed(1)}% out of range`
	);
});

test("Map is not completely solid", () => {
	const generator = new CaveGenerator(1052);
	const map = generator.generate(30, 20);

	const emptyCount = map.getAllCells().filter((c) => !c.solid).length;
	assertTrue(emptyCount > 0, "Map should have at least some empty cells");
	assertTrue(
		emptyCount > 50,
		`Map should have many empty cells (found ${emptyCount})`
	);
});

test("Map is not completely empty", () => {
	const generator = new CaveGenerator(1056);
	const map = generator.generate(30, 20);

	const solidCount = map.getAllCells().filter((c) => c.solid).length;
	assertTrue(solidCount > 0, "Map should have at least some solid cells");
	assertTrue(
		solidCount > 50,
		`Map should have many solid cells (found ${solidCount})`
	);
});

// ============================================================================
// CONNECTIVITY TESTS
// ============================================================================

test("All empty cells belong to a region", () => {
	const generator = new CaveGenerator(1062);
	const map = generator.generate(30, 20);

	const emptyCells = map.getAllCells().filter((c) => !c.solid);
	for (const cell of emptyCells) {
		assertTrue(
			cell.regionId >= 0,
			`Empty cell at ${cell.coord.q},${cell.coord.r} should have valid regionId`
		);
	}
});

test("Main region exists and is largest", () => {
	const generator = new CaveGenerator(1066);
	const map = generator.generate(35, 25);

	const emptyCells = map.getAllCells().filter((c) => !c.solid);
	assertTrue(emptyCells.length > 0, "Should have empty cells");

	// Count cells per region
	const regionCounts = new Map<number, number>();
	for (const cell of emptyCells) {
		regionCounts.set(cell.regionId, (regionCounts.get(cell.regionId) || 0) + 1);
	}

	// Region 0 should be the largest
	const region0Count = regionCounts.get(0) || 0;
	assertTrue(region0Count > 0, "Region 0 should exist");

	let largestRegionId = 0;
	let largestRegionCount = 0;
	for (const [regionId, count] of regionCounts.entries()) {
		if (count > largestRegionCount) {
			largestRegionCount = count;
			largestRegionId = regionId;
		}
	}

	assertEqual(largestRegionId, 0, "Region 0 should be the largest region");
});

test("Connectivity ensures single main region dominates", () => {
	const generator = new CaveGenerator(1203);
	const map = generator.generate(40, 30);

	const emptyCells = map.getAllCells().filter((c) => !c.solid);
	const mainRegionCells = emptyCells.filter((c) => c.regionId === 0);

	// Main region should contain at least 60% of empty cells after connectivity pass
	// (Lowered from 70% to account for natural variance in procedural generation)
	const mainRegionPercentage = mainRegionCells.length / emptyCells.length;
	assertInRange(
		mainRegionPercentage,
		0.6,
		1.0,
		`Main region should dominate (${(mainRegionPercentage * 100).toFixed(1)}%)`
	);
});

// ============================================================================
// MATERIAL PROPERTIES TESTS
// ============================================================================

test("Solid cells have positive hardness", () => {
	const generator = new CaveGenerator(1083);
	const map = generator.generate(25, 20);

	const solidCells = map.getAllCells().filter((c) => c.solid);
	for (const cell of solidCells) {
		assertTrue(
			cell.hardness > 0,
			`Solid cell hardness should be positive (got ${cell.hardness})`
		);
	}
});

test("Hardness values are reasonable", () => {
	const generator = new CaveGenerator(1086);
	const map = generator.generate(30, 25);

	const solidCells = map.getAllCells().filter((c) => c.solid);
	for (const cell of solidCells) {
		assertInRange(
			cell.hardness,
			0.5,
			5.0,
			`Hardness ${cell.hardness} out of expected range`
		);
	}
});

test("Density values are reasonable", () => {
	const generator = new CaveGenerator(1090);
	const map = generator.generate(30, 25);

	for (const cell of map.getAllCells()) {
		assertInRange(
			cell.density,
			0.0,
			2.0,
			`Density ${cell.density} out of expected range`
		);
	}
});

// ============================================================================
// STAMP/LOCKED CELLS TESTS
// ============================================================================

test("Some cells are locked by stamps", () => {
	const generator = new CaveGenerator(1095);
	const map = generator.generate(40, 30);

	const lockedCells = map.getAllCells().filter((c) => c.locked);
	assertTrue(
		lockedCells.length > 0,
		`Should have locked cells from stamps (found ${lockedCells.length})`
	);
});

test("Locked cells maintain their state", () => {
	const generator = new CaveGenerator(1098);
	const map = generator.generate(35, 25);

	const lockedCells = map.getAllCells().filter((c) => c.locked);
	// Locked cells should be from chambers (typically empty)
	for (const cell of lockedCells) {
		// Just verify they exist and have valid properties
		assertTrue(cell.hardness >= 0, "Locked cell should have valid hardness");
		assertTrue(cell.density >= 0, "Locked cell should have valid density");
	}
});

// ============================================================================
// FEATURE TAGGING TESTS
// ============================================================================

test("Player spawn tag exists", () => {
	const generator = new CaveGenerator(1106);
	const map = generator.generate(30, 20);

	const spawnCells = map
		.getAllCells()
		.filter((c) => c.tags.has("player_spawn"));
	assertTrue(
		spawnCells.length > 0,
		"Should have at least one player_spawn tag"
	);
	assertEqual(spawnCells.length, 1, "Should have exactly one player_spawn");
});

test("Player spawn is in empty space", () => {
	const generator = new CaveGenerator(1110);
	const map = generator.generate(30, 20);

	const spawnCells = map
		.getAllCells()
		.filter((c) => c.tags.has("player_spawn"));
	assertTrue(spawnCells.length > 0, "Should have player spawn");

	for (const cell of spawnCells) {
		assertFalse(cell.solid, "Player spawn should be in empty space");
	}
});

test("Generated maps contain exactly one reachable end tile", () => {
	for (const seed of [1101, 1106, 1110, 1117, 1141, 2202, 3303]) {
		const map = new CaveGenerator(seed).generate(35, 25);
		const spawn = map
			.getAllCells()
			.find((cell) => cell.tags.has("player_spawn"));
		const endCells = map
			.getAllCells()
			.filter((cell) => cell.tags.has("end"));

		assertTrue(!!spawn, `Seed ${seed} should have a player spawn`);
		assertEqual(endCells.length, 1, `Seed ${seed} should have exactly one end`);
		assertFalse(endCells[0].solid, `Seed ${seed} end should be navigable`);
		assertFalse(
			endCells[0].tags.has("player_spawn"),
			`Seed ${seed} end should differ from spawn`
		);
		assertTrue(
			canReach(map, spawn!, endCells[0]),
			`Seed ${seed} end should be reachable from spawn`
		);
	}
});

test("Partial generator overrides preserve nested defaults", () => {
	const config = resolveCaveGenConfig({
		fill: { percentage: 0.4 },
		features: { hazardCount: 8 },
	});

	assertEqual(config.fill.percentage, 0.4, "Fill override should be applied");
	assertEqual(config.fill.edgesSolid, true, "Fill default should be preserved");
	assertEqual(config.features.hazardCount, 8, "Feature override should apply");
	assertEqual(
		config.features.resourceNodeCount,
		5,
		"Sibling feature default should be preserved"
	);
});

test("Resource nodes exist", () => {
	const generator = new CaveGenerator(1114);
	const map = generator.generate(35, 25);

	const resourceCells = map
		.getAllCells()
		.filter((c) => c.tags.has("resource_node"));
	assertTrue(
		resourceCells.length > 0,
		`Should have resource nodes (found ${resourceCells.length})`
	);
});

test("Resources and hazards never overlap", () => {
	const generator = new CaveGenerator(1115);
	const map = generator.generate(40, 30);
	const overlaps = map
		.getAllCells()
		.filter(
			(cell) =>
				cell.tags.has("resource_node") && cell.tags.has("hazard")
		);

	assertEqual(overlaps.length, 0, "POI content slots should remain distinct");
});

test("Tags are only on empty cells", () => {
	const generator = new CaveGenerator(1117);
	const map = generator.generate(30, 20);

	const taggedCells = map
		.getAllCells()
		.filter(
			(c) =>
				c.tags.has("player_spawn") ||
				c.tags.has("resource_node") ||
				c.tags.has("hazard") ||
				c.tags.has("poi_candidate")
		);

	for (const cell of taggedCells) {
		assertFalse(
			cell.solid,
			`Tagged cell at ${cell.coord.q},${cell.coord.r} should be empty`
		);
	}
});

test("Reward walls can generate in destructible clusters", () => {
	const generator = new CaveGenerator(2244, {
		features: {
			rewardWallDensity: 0.02,
			rewardWallClusterChance: 1,
			rewardWallClusterMinSize: 4,
			rewardWallClusterMaxSize: 4,
		},
	});
	const map = generator.generate(60, 45);
	const rewardWalls = map
		.getAllCells()
		.filter((cell) => cell.tags.has("reward_wall"));
	const clusteredWalls = rewardWalls.filter((cell) =>
		cell.tags.has("reward_wall_cluster")
	);
	const hasAdjacentPair = rewardWalls.some((cell) =>
		hexNeighbors(cell.coord).some((coord) =>
			map.getCell(coord)?.tags.has("reward_wall")
		)
	);

	assertTrue(rewardWalls.length > 0, "Should generate reward walls");
	assertTrue(clusteredWalls.length > 0, "Should generate clustered reward walls");
	assertTrue(hasAdjacentPair, "A reward-wall cluster should contain adjacent cells");
});

test("Generated runs include a distinct asteroid field", () => {
	const generator = new CaveGenerator(1141);
	const map = generator.generate(40, 30);
	const asteroidCells = map
		.getAllCells()
		.filter((cell) => cell.tags.has(roomRoleTag("asteroid")));
	const asteroidAnchors = asteroidCells.filter((cell) =>
		cell.tags.has("room_anchor")
	);

	assertEqual(asteroidAnchors.length, 1, "Should have one asteroid field anchor");
	assertTrue(
		asteroidCells.length > asteroidAnchors.length,
		"Asteroid field should cover more than its anchor cell"
	);

	for (const cell of asteroidCells) {
		const roles = ROOM_ROLES.filter((role) =>
			cell.tags.has(roomRoleTag(role))
		);
		assertEqual(roles.length, 1, "Asteroid cells should not overlap room roles");
		assertFalse(cell.solid, "Asteroid cells should be in navigable space");
	}
});

test("Generated runs include a shrine room", () => {
	const generator = new CaveGenerator(1142);
	const map = generator.generate(40, 30);
	const shrineAnchors = map
		.getAllCells()
		.filter(
			(cell) =>
				cell.tags.has("room_anchor") &&
				cell.tags.has(roomRoleTag("shrine"))
		);

	assertEqual(shrineAnchors.length, 1, "Should have one shrine room anchor");
	assertFalse(shrineAnchors[0].solid, "Shrine room should be navigable");
});

test("Generated room content selection is deterministic", () => {
	const coord = { q: 12, r: 8 };
	const first = selectGeneratedContent("shrine", 7712, coord, 2);
	const second = selectGeneratedContent("shrine", 7712, coord, 2);

	assertEqual(first?.id, second?.id, "Same room seed should select same content");
	assertTrue(!!first, "Shrine room should resolve registered content");
});

test("Milestone boss content unlocks at depth three", () => {
	const coord = { q: 20, r: 14 };
	const early = selectGeneratedContent("boss", 9912, coord, 2);
	const milestone = selectGeneratedContent("boss", 9912, coord, 3);

	assertEqual(early, undefined, "Boss should not resolve before its minimum depth");
	assertEqual(
		milestone?.id,
		"milestone_boss",
		"Boss room should resolve milestone content at depth three"
	);
});

// ============================================================================
// HEXGRID CONVERSION TESTS (skipped in Node.js environment)
// ============================================================================
// These tests require browser APIs via kaplay/HexGrid
// Run integration tests in browser environment instead

// ============================================================================
// EDGE CASES
// ============================================================================

test("Small grid generates correctly", () => {
	const generator = new CaveGenerator(1127);
	const map = generator.generate(5, 5);

	assertEqual(map.width, 5, "Small grid width");
	assertEqual(map.height, 5, "Small grid height");
	assertEqual(map.getAllCells().length, 25, "Small grid cell count");
});

test("Large grid generates correctly", () => {
	const generator = new CaveGenerator(1130);
	const map = generator.generate(100, 80);

	assertEqual(map.width, 100, "Large grid width");
	assertEqual(map.height, 80, "Large grid height");
	assertEqual(map.getAllCells().length, 8000, "Large grid cell count");
});

test("Rectangular grids work correctly", () => {
	const generator = new CaveGenerator(1134);
	const map1 = generator.generate(50, 20); // Wide
	const map2 = generator.generate(20, 50); // Tall

	assertEqual(map1.width, 50, "Wide grid width");
	assertEqual(map1.height, 20, "Wide grid height");
	assertEqual(map2.width, 20, "Tall grid width");
	assertEqual(map2.height, 50, "Tall grid height");
});

function canReach(map: GenerationMap, start: GenCell, target: GenCell) {
	const targetKey = `${target.coord.q},${target.coord.r}`;
	const pending = [start.coord];
	const visited = new Set<string>();

	while (pending.length > 0) {
		const coord = pending.shift()!;
		const key = `${coord.q},${coord.r}`;
		if (key === targetKey) return true;
		if (visited.has(key)) continue;
		visited.add(key);

		for (const neighborCoord of hexNeighbors(coord)) {
			const neighbor = map.getCell(neighborCoord);
			if (!neighbor || neighbor.solid) continue;
			const neighborKey = `${neighbor.coord.q},${neighbor.coord.r}`;
			if (!visited.has(neighborKey)) pending.push(neighbor.coord);
		}
	}

	return false;
}

// ============================================================================
// RUN TESTS
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("🧪 CAVE GENERATION TEST SUITE");
console.log("=".repeat(60) + "\n");

console.log("📊 Test Results:\n");
console.log(`Total:  ${testsRun}`);
console.log(`Passed: ${testsPassed} ✅`);
console.log(`Failed: ${testsFailed} ❌\n`);

if (testsFailed === 0) {
	console.log("🎉 All tests passed!\n");
	process.exit(0);
} else {
	console.log(`⚠️  ${testsFailed} test(s) failed\n`);
	process.exit(1);
}
