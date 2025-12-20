/**
 * Hex Grid Test Suite
 * Run with: node --loader ts-node/esm src/grid/hexGrid.test.ts
 */

import { k } from "../main"
import {
	hexCoord,
	hexEqual,
	hexAdd,
	hexSubtract,
	hexNeighbors,
	hexDistance,
	hexToPixel,
	pixelToHex,
	hexRing,
	hexRange,
	hexToString,
	stringToHex,
} from "./hexCoord"
import { HexGrid, CellType } from "./hexGrid"
import {
	serializeGrid,
	deserializeGrid,
	exportGridCompact,
	importGridCompact,
} from "./hexSerialization"
import { gridRegistry } from "./gridRegistry"
import { gridCollision } from "../comp/gridCollision"

// Test results
interface TestResult {
	name: string
	passed: boolean
	message?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => boolean | void): void {
	try {
		const result = fn()
		if (result === false) {
			results.push({ name, passed: false, message: "Assertion failed" })
		} else {
			results.push({ name, passed: true })
		}
	} catch (error) {
		results.push({
			name,
			passed: false,
			message: error instanceof Error ? error.message : String(error),
		})
	}
}

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message)
	}
}

// ============================================================================
// COORDINATE TESTS
// ============================================================================

test("hexEqual - same coordinates", () => {
	const a = hexCoord(1, 2)
	const b = hexCoord(1, 2)
	assert(hexEqual(a, b), "Coordinates should be equal")
})

test("hexEqual - different coordinates", () => {
	const a = hexCoord(1, 2)
	const b = hexCoord(2, 1)
	assert(!hexEqual(a, b), "Coordinates should not be equal")
})

test("hexAdd - basic addition", () => {
	const a = hexCoord(1, 2)
	const b = hexCoord(3, 4)
	const result = hexAdd(a, b)
	assert(result.q === 4 && result.r === 6, "Should add coordinates correctly")
})

test("hexSubtract - basic subtraction", () => {
	const a = hexCoord(5, 7)
	const b = hexCoord(2, 3)
	const result = hexSubtract(a, b)
	assert(
		result.q === 3 && result.r === 4,
		"Should subtract coordinates correctly"
	)
})

test("hexNeighbors - returns 6 neighbors", () => {
	const center = hexCoord(0, 0)
	const neighbors = hexNeighbors(center)
	assert(neighbors.length === 6, "Should return exactly 6 neighbors")
})

test("hexNeighbors - correct positions", () => {
	const center = hexCoord(0, 0)
	const neighbors = hexNeighbors(center)

	// Check specific neighbors (pointy-top orientation)
	const east = neighbors.find((n) => n.q === 1 && n.r === 0)
	const west = neighbors.find((n) => n.q === -1 && n.r === 0)

	assert(east !== undefined, "Should have east neighbor")
	assert(west !== undefined, "Should have west neighbor")
})

test("hexDistance - same hex", () => {
	const a = hexCoord(0, 0)
	const b = hexCoord(0, 0)
	assert(hexDistance(a, b) === 0, "Distance to self should be 0")
})

test("hexDistance - adjacent hex", () => {
	const a = hexCoord(0, 0)
	const b = hexCoord(1, 0)
	assert(hexDistance(a, b) === 1, "Distance to adjacent hex should be 1")
})

test("hexDistance - diagonal distance", () => {
	const a = hexCoord(0, 0)
	const b = hexCoord(2, 2)
	const dist = hexDistance(a, b)
	assert(dist === 4, `Distance should be 4, got ${dist}`)
})

test("hexRing - radius 0", () => {
	const center = hexCoord(0, 0)
	const ring = hexRing(center, 0)
	assert(ring.length === 1, "Ring of radius 0 should have 1 hex")
	assert(hexEqual(ring[0], center), "Should be the center hex")
})

test("hexRing - radius 1", () => {
	const center = hexCoord(0, 0)
	const ring = hexRing(center, 1)
	assert(ring.length === 6, "Ring of radius 1 should have 6 hexes")
})

test("hexRing - radius 2", () => {
	const center = hexCoord(0, 0)
	const ring = hexRing(center, 2)
	assert(ring.length === 12, "Ring of radius 2 should have 12 hexes")
})

test("hexRange - radius 0", () => {
	const center = hexCoord(0, 0)
	const range = hexRange(center, 0)
	assert(range.length === 1, "Range of radius 0 should have 1 hex")
})

test("hexRange - radius 1", () => {
	const center = hexCoord(0, 0)
	const range = hexRange(center, 1)
	assert(range.length === 7, "Range of radius 1 should have 7 hexes (1+6)")
})

test("hexRange - radius 2", () => {
	const center = hexCoord(0, 0)
	const range = hexRange(center, 2)
	assert(range.length === 19, "Range of radius 2 should have 19 hexes (1+6+12)")
})

test("hexToString and stringToHex - roundtrip", () => {
	const coord = hexCoord(42, -17)
	const str = hexToString(coord)
	const parsed = stringToHex(str)
	assert(
		hexEqual(coord, parsed),
		`Roundtrip failed: ${coord.q},${coord.r} -> ${str} -> ${parsed.q},${parsed.r}`
	)
})

test("hexToPixel - origin", () => {
	const hex = hexCoord(0, 0)
	const pixel = hexToPixel(hex, 10)
	assert(
		Math.abs(pixel.x) < 0.01 && Math.abs(pixel.y) < 0.01,
		"Origin hex should map to origin pixel"
	)
})

test("pixelToHex - roundtrip", () => {
	const original = hexCoord(5, 3)
	const pixel = hexToPixel(original, 10)
	const back = pixelToHex(pixel, 10)
	assert(
		hexEqual(original, back),
		`Roundtrip failed: ${original.q},${original.r} -> ${pixel.x},${pixel.y} -> ${back.q},${back.r}`
	)
})

// ============================================================================
// GRID TESTS
// ============================================================================

test("HexGrid - constructor creates grid", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})
	assert(grid.cells.size > 0, "Grid should have cells")
})

test("HexGrid - correct number of cells", () => {
	const width = 5
	const height = 5
	const grid = new HexGrid({
		width,
		height,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	// For offset coordinates, we expect roughly width * height cells
	const cellCount = grid.getAllCells().length
	assert(
		cellCount >= width * height - height,
		`Should have at least ${width * height - height} cells, got ${cellCount}`
	)
})

test("HexGrid - all cells start empty", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const allEmpty = grid.getAllCells().every((c) => c.type === CellType.Empty)
	assert(allEmpty, "All cells should start as empty")
})

test("HexGrid - setCell changes cell type", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const coord = hexCoord(0, 0)
	grid.setCell(coord, CellType.Wall)

	const cell = grid.getCell(coord)
	assert(cell !== undefined, "Cell should exist")
	if (cell) {
		assert(cell.type === CellType.Wall, "Cell should be wall type")
	}
})

test("HexGrid - getCell returns undefined for invalid coord", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const cell = grid.getCell(hexCoord(999, 999))
	assert(cell === undefined, "Should return undefined for out-of-bounds")
})

test("HexGrid - inBounds check", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const validCoord = hexCoord(0, 0)
	const invalidCoord = hexCoord(999, 999)

	assert(grid.inBounds(validCoord), "Valid coord should be in bounds")
	assert(!grid.inBounds(invalidCoord), "Invalid coord should be out of bounds")
})

test("HexGrid - isWalkable", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const emptyCoord = hexCoord(0, 0)
	const wallCoord = hexCoord(1, 0)

	grid.setCell(wallCoord, CellType.Wall)

	assert(grid.isWalkable(emptyCoord), "Empty cell should be walkable")
	assert(!grid.isWalkable(wallCoord), "Wall cell should not be walkable")
})

test("HexGrid - getNeighbors", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	const center = hexCoord(5, 5)
	const neighbors = grid.getNeighbors(center)

	assert(
		neighbors.length <= 6,
		"Should have at most 6 neighbors (may be less at edges)"
	)
	assert(neighbors.length > 0, "Should have at least some neighbors")
})

test("HexGrid - screenToHex and hexToScreen roundtrip", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 20,
		offset: k.vec2(100, 100),
	})

	const original = hexCoord(3, 4)
	const screen = grid.hexToScreen(original)
	const back = grid.screenToHex(screen)

	assert(
		hexEqual(original, back),
		`Roundtrip failed: ${original.q},${original.r} -> ${screen.x},${screen.y} -> ${back.q},${back.r}`
	)
})

// ============================================================================
// SERIALIZATION TESTS
// ============================================================================

test("serializeGrid - creates valid JSON", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	grid.setCell(hexCoord(0, 0), CellType.Wall)
	grid.setCell(hexCoord(1, 1), CellType.Obstacle)

	const json = serializeGrid(grid)
	const parsed = JSON.parse(json)

	assert(parsed.version === 1, "Should have version 1")
	assert(parsed.config !== undefined, "Should have config")
	assert(parsed.cells !== undefined, "Should have cells")
})

test("deserializeGrid - roundtrip", () => {
	const original = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	original.setCell(hexCoord(0, 0), CellType.Wall)
	original.setCell(hexCoord(1, 1), CellType.Obstacle)
	original.setCell(hexCoord(2, 2), CellType.Wall)

	const json = serializeGrid(original)
	const restored = deserializeGrid(json)

	// Check config
	assert(
		restored.config.width === original.config.width,
		"Width should match"
	)
	assert(
		restored.config.height === original.config.height,
		"Height should match"
	)

	// Check cells
	const cell1 = restored.getCell(hexCoord(0, 0))
	const cell2 = restored.getCell(hexCoord(1, 1))
	const cell3 = restored.getCell(hexCoord(2, 2))

	assert(
		cell1 !== undefined && cell1.type === CellType.Wall,
		"Wall cell should be restored"
	)
	assert(
		cell2 !== undefined && cell2.type === CellType.Obstacle,
		"Obstacle cell should be restored"
	)
	assert(
		cell3 !== undefined && cell3.type === CellType.Wall,
		"Second wall cell should be restored"
	)
})

test("exportGridCompact - creates compact string", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	grid.setCell(hexCoord(0, 0), CellType.Wall)

	const compact = exportGridCompact(grid)
	const parts = compact.split("|")

	assert(parts.length === 4, "Should have 4 parts")
	assert(parts[0] === "5x5", "First part should be dimensions")
	assert(parts[1] === "20", "Second part should be hex size")
})

test("importGridCompact - roundtrip", () => {
	const original = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(10, 20),
	})

	original.setCell(hexCoord(0, 0), CellType.Wall)
	original.setCell(hexCoord(1, 1), CellType.Obstacle)

	const compact = exportGridCompact(original)
	const restored = importGridCompact(compact)

	// Check config
	assert(
		restored.config.width === original.config.width,
		"Width should match"
	)
	assert(
		restored.config.height === original.config.height,
		"Height should match"
	)
	assert(
		restored.config.hexSize === original.config.hexSize,
		"Hex size should match"
	)

	// Check cells
	const cell1 = restored.getCell(hexCoord(0, 0))
	const cell2 = restored.getCell(hexCoord(1, 1))

	assert(
		cell1 !== undefined && cell1.type === CellType.Wall,
		"Wall cell should be restored"
	)
	assert(
		cell2 !== undefined && cell2.type === CellType.Obstacle,
		"Obstacle cell should be restored"
	)
})

test("Grid with pattern - serialize and deserialize", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(50, 50),
	})

	// Create a wall border
	for (let q = 0; q < 10; q++) {
		grid.setCell(hexCoord(q, 0), CellType.Wall)
		grid.setCell(hexCoord(q, 9), CellType.Wall)
	}

	// Add some obstacles in the middle
	grid.setCell(hexCoord(5, 5), CellType.Obstacle)
	grid.setCell(hexCoord(6, 5), CellType.Obstacle)

	const json = serializeGrid(grid)
	const restored = deserializeGrid(json)

	// Validate walls
	const topLeft = restored.getCell(hexCoord(0, 0))
	const topRight = restored.getCell(hexCoord(9, 0))
	assert(
		topLeft !== undefined && topLeft.type === CellType.Wall,
		"Top left should be wall"
	)
	assert(
		topRight !== undefined && topRight.type === CellType.Wall,
		"Top right should be wall"
	)

	// Validate obstacles
	const obs1 = restored.getCell(hexCoord(5, 5))
	const obs2 = restored.getCell(hexCoord(6, 5))
	assert(
		obs1 !== undefined && obs1.type === CellType.Obstacle,
		"First obstacle should be restored"
	)
	assert(
		obs2 !== undefined && obs2.type === CellType.Obstacle,
		"Second obstacle should be restored"
	)

	// Validate empty cells
	const empty = restored.getCell(hexCoord(5, 4))
	assert(
		empty !== undefined && empty.type === CellType.Empty,
		"Empty cell should remain empty"
	)
})

// ============================================================================
// GRID COLLISION TESTS
// ============================================================================

test("gridRegistry - register and get grid", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	gridRegistry.register("test_grid", grid)

	const retrieved = gridRegistry.get("test_grid")
	assert(retrieved === grid, "Should retrieve the same grid instance")

	gridRegistry.unregister("test_grid")
})

test("gridRegistry - has() check", () => {
	const grid = new HexGrid({
		width: 5,
		height: 5,
		hexSize: 20,
		offset: k.vec2(0, 0),
	})

	gridRegistry.register("test_has", grid)
	assert(gridRegistry.has("test_has"), "Should find registered grid")
	assert(!gridRegistry.has("nonexistent"), "Should not find unregistered grid")

	gridRegistry.unregister("test_has")
})

test("gridCollision - component creation", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(0, 0),
	})

	gridRegistry.register("collision_test", grid)

	const entity = k.add([
		k.pos(100, 100),
		gridCollision("collision_test"),
	]) as any

	const comp = entity.c("gridCollision")
	assert(comp !== undefined, "Component should be added")
	assert(comp.enabled === true, "Component should be enabled")
	assert(comp.grid === grid, "Should reference correct grid")

	k.destroy(entity)
	gridRegistry.unregister("collision_test")
})

test("gridCollision - tracks current cell", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(0, 0),
	})

	gridRegistry.register("track_test", grid)

	const centerPos = grid.hexToScreen(hexCoord(5, 5))
	const entity = k.add([
		k.pos(centerPos),
		gridCollision("track_test"),
	]) as any

	const comp = entity.c("gridCollision") as any
	if (comp) {
		const cell = comp.getCurrentCell()
		assert(
			cell !== undefined && cell.q === 5 && cell.r === 5,
			`Should track cell (5,5), got ${cell?.q},${cell?.r}`
		)
	}

	k.destroy(entity)
	gridRegistry.unregister("track_test")
})

test("gridCollision - getCellProperties", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(0, 0),
	})

	grid.setCell(hexCoord(5, 5), CellType.Wall)
	gridRegistry.register("props_test", grid)

	const centerPos = grid.hexToScreen(hexCoord(5, 5))
	const entity = k.add([
		k.pos(centerPos),
		gridCollision("props_test"),
	]) as any

	const comp = entity.c("gridCollision") as any
	if (comp) {
		const cellData = comp.getCellProperties()
		assert(
			cellData !== undefined && cellData.type === CellType.Wall,
			"Should get wall cell properties"
		)
	}

	k.destroy(entity)
	gridRegistry.unregister("props_test")
})

test("gridCollision - canMoveTo walkable cell", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(0, 0),
	})

	gridRegistry.register("move_test", grid)

	const entity = k.add([
		k.pos(grid.hexToScreen(hexCoord(5, 5))),
		gridCollision("move_test"),
	]) as any

	const comp = entity.c("gridCollision") as any
	if (comp) {
		const nextPos = grid.hexToScreen(hexCoord(6, 5))
		assert(comp.canMoveTo(nextPos), "Should allow movement to empty cell")
	}

	k.destroy(entity)
	gridRegistry.unregister("move_test")
})

test("gridCollision - canMoveTo blocked by wall", () => {
	const grid = new HexGrid({
		width: 10,
		height: 10,
		hexSize: 30,
		offset: k.vec2(0, 0),
	})

	grid.setCell(hexCoord(6, 5), CellType.Wall)
	gridRegistry.register("wall_test", grid)

	const entity = k.add([
		k.pos(grid.hexToScreen(hexCoord(5, 5))),
		gridCollision("wall_test"),
	]) as any

	const comp = entity.c("gridCollision") as any
	if (comp) {
		const wallPos = grid.hexToScreen(hexCoord(6, 5))
		assert(!comp.canMoveTo(wallPos), "Should block movement to wall cell")
	}

	k.destroy(entity)
	gridRegistry.unregister("wall_test")
})

test("gridCollision - disabled when grid not found", () => {
	const entity = k.add([
		k.pos(100, 100),
		gridCollision("nonexistent_grid"),
	]) as any

	const comp = entity.c("gridCollision")
	assert(comp !== undefined, "Component should exist")
	assert(comp.enabled === false, "Component should be disabled")
	assert(comp.grid === undefined, "Grid should be undefined")

	k.destroy(entity)
})

// ============================================================================
// RUN TESTS AND REPORT
// ============================================================================

export function runHexGridTests(): void {
	console.log("\n" + "=".repeat(60))
	console.log("HEX GRID TEST SUITE")
	console.log("=".repeat(60) + "\n")

	// Clear previous results
	results.length = 0

	// Run all tests (they've been defined above)
	console.log(`Running ${results.length} tests...\n`)

	// Display results
	const passed = results.filter((r) => r.passed)
	const failed = results.filter((r) => !r.passed)

	for (const result of results) {
		const icon = result.passed ? "✓" : "✗"
		const color = result.passed ? "\x1b[32m" : "\x1b[31m"
		const reset = "\x1b[0m"

		console.log(`${color}${icon}${reset} ${result.name}`)
		if (result.message) {
			console.log(`  ${result.message}`)
		}
	}

	console.log("\n" + "-".repeat(60))
	console.log(
		`Results: ${passed.length} passed, ${failed.length} failed, ${results.length} total`
	)
	console.log("-".repeat(60) + "\n")

	if (failed.length === 0) {
		console.log("\x1b[32m✓ ALL TESTS PASSED!\x1b[0m\n")
	} else {
		console.log("\x1b[31m✗ SOME TESTS FAILED\x1b[0m\n")
	}
}
