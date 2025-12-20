import { k } from "../main"
import { CellType, HexGrid } from "../grid/hexGrid"
import { deserializeGrid, serializeGrid } from "../grid/hexSerialization"
import { hexCoord } from "../grid/hexCoord"
import { gridRegistry } from "../grid/gridRegistry"
import { gridCollision } from "../comp/gridCollision"
import { loadPatternFromStorage } from "../levelEditor/editorPatterns"

let hexGrid: HexGrid | undefined
let gridDebugMode = false
let testEntity: any = undefined

const GRID_KEY = "test"

/**
 * Create a test hex grid level
 */
export function createTestHexGrid() {
	// Clear existing grid
	if (hexGrid) {
		gridRegistry.unregister(GRID_KEY)
	}

	// Create grid centered on screen
	hexGrid = new HexGrid({
		width: 15,
		height: 10,
		hexSize: 40,
		offset: k.vec2(k.width() / 2 - 300, k.height() / 2 - 200),
	})

	// Register grid
	gridRegistry.register(GRID_KEY, hexGrid)

	// Add some walls for testing
	for (let q = 0; q < 5; q++) {
		hexGrid.setCell(hexCoord(q, 0), CellType.Wall)
		hexGrid.setCell(hexCoord(q, 9), CellType.Wall)
	}

	// Add obstacles
	hexGrid.setCell(hexCoord(7, 5), CellType.Obstacle)
	hexGrid.setCell(hexCoord(8, 5), CellType.Obstacle)
	hexGrid.setCell(hexCoord(7, 6), CellType.Obstacle)

	// Create test entity with collision
	if (testEntity) {
		k.destroy(testEntity)
	}

	const startPos = hexGrid.hexToScreen(hexCoord(5, 5))
	testEntity = k.add([
		k.pos(startPos),
		k.circle(8),
		k.color(k.Color.fromHex("#00FF00")),
		k.anchor("center"),
		k.z(100),
		gridCollision(GRID_KEY),
		"testEntity",
	])

	// Log collision events
	testEntity.onCollide((cell: any) => {
		console.log(`Collision with ${cell.type} cell at ${cell.coord.q},${cell.coord.r}`)
	})

	// Movement controls
	testEntity.onUpdate(() => {
		const speed = 100
		const moveVec = k.vec2(0, 0)

		if (k.isKeyDown("up")) moveVec.y -= speed * k.dt()
		if (k.isKeyDown("down")) moveVec.y += speed * k.dt()
		if (k.isKeyDown("left")) moveVec.x -= speed * k.dt()
		if (k.isKeyDown("right")) moveVec.x += speed * k.dt()

		if (moveVec.len() > 0) {
			testEntity.move(moveVec)
		}

		// Display current cell info
		const cellData = testEntity.getCellProperties()
		if (cellData && gridDebugMode) {
			k.drawText({
				text: `Cell: ${cellData.coord.q},${cellData.coord.r} (${cellData.type})`,
				pos: k.vec2(10, k.height() - 30),
				size: 14,
				color: k.WHITE,
			})
		}
	})

	// Draw grid
	k.onDraw(() => {
		if (!hexGrid) return
		renderHexGrid(hexGrid)
	})

	console.log("Hex grid created!")
	console.log("Controls: Arrow keys to move, G=debug, S=save, L=load")
	console.log(`Test entity spawned at ${startPos.x},${startPos.y}`)
}

/**
 * Render hex grid
 */
function renderHexGrid(grid: HexGrid) {
	for (const cell of grid.getAllCells()) {
		const corners = grid.getHexScreenCorners(cell.coord)

		// Draw filled hex
		k.drawPolygon({
			pts: corners,
			color: cell.color,
			opacity: cell.type === CellType.Empty ? 0.1 : 0.6,
			fill: true,
		})

		// Draw outline
		k.drawPolygon({
			pts: corners,
			color: k.WHITE,
			opacity: gridDebugMode ? 0.3 : 0.1,
			fill: false,
		})

		// Draw coordinates in debug mode
		if (gridDebugMode) {
			const center = grid.hexToScreen(cell.coord)
			k.drawText({
				text: `${cell.coord.q},${cell.coord.r}`,
				pos: center,
				size: 10,
				anchor: "center",
				color: k.WHITE,
			})
		}
	}

	// Draw grid bounds
	if (gridDebugMode) {
		const bounds = grid.getScreenBounds()
		k.drawRect({
			pos: k.vec2(bounds.minX, bounds.minY),
			width: bounds.maxX - bounds.minX,
			height: bounds.maxY - bounds.minY,
			outline: { color: k.RED, width: 2 },
			fill: false,
		})
	}
}

/**
 * Save current grid to console
 */
export function saveHexGrid() {
	if (!hexGrid) {
		console.log("No grid to save")
		return
	}

	const json = serializeGrid(hexGrid)
	console.log("=== SAVED GRID (JSON) ===")
	console.log(json)
	console.log("=========================")

	// Also save to localStorage for persistence
	localStorage.setItem("hexGrid_test", json)
	console.log("Grid saved to localStorage!")
}

/**
 * Load grid from console input
 */
export function loadHexGrid() {
	const saved = localStorage.getItem("hexGrid_test")

	if (!saved) {
		console.log("No saved grid found in localStorage")
		return
	}

	try {
		hexGrid = deserializeGrid(saved)
		console.log("Grid loaded from localStorage!")
	} catch (error) {
		console.error("Failed to load grid:", error)
	}
}

/**
 * Toggle debug mode
 */
export function toggleGridDebug() {
	gridDebugMode = !gridDebugMode
	console.log(`Grid debug mode: ${gridDebugMode ? "ON" : "OFF"}`)
}

/**
 * Get current hex grid instance
 */
export function getHexGrid(): HexGrid | undefined {
	return hexGrid
}

/**
 * Inject a saved pattern into the grid at position
 */
export function injectPatternToGrid() {
	if (!hexGrid) {
		console.log("No grid to inject pattern into. Press H to create grid first.")
		return
	}

	const patternName = prompt("Enter pattern name to inject:")
	if (!patternName) return

	const pattern = loadPatternFromStorage(patternName)
	if (!pattern) {
		console.log(`Pattern "${patternName}" not found`)
		return
	}

	const qStr = prompt("Enter q coordinate (hex coord):", "0")
	const rStr = prompt("Enter r coordinate (hex coord):", "0")

	if (!qStr || !rStr) return

	const offset = hexCoord(parseInt(qStr), parseInt(rStr))

	hexGrid.injectPattern(pattern.cells, offset)
	console.log(`Pattern "${patternName}" injected at ${offset.q},${offset.r}`)
}
