import { CellType, HexGrid, HexGridConfig } from "./hexGrid"
import { hexToString, stringToHex } from "./hexCoord"
import { k } from "../main"

/**
 * Serialized grid data (JSON format)
 */
export interface SerializedGrid {
	version: number
	config: {
		width: number
		height: number
		hexSize: number
		offset: { x: number; y: number }
	}
	cells: Record<string, CellType> // Map of "q,r" -> cellType
}

/**
 * Serialize hex grid to JSON string
 */
export function serializeGrid(grid: HexGrid): string {
	const data: SerializedGrid = {
		version: 1,
		config: {
			width: grid.config.width,
			height: grid.config.height,
			hexSize: grid.config.hexSize,
			offset: {
				x: grid.config.offset.x,
				y: grid.config.offset.y,
			},
		},
		cells: {},
	}

	// Store only non-empty cells for compression
	for (const cell of grid.getAllCells()) {
		if (cell.type !== CellType.Empty) {
			const key = hexToString(cell.coord)
			data.cells[key] = cell.type
		}
	}

	return JSON.stringify(data)
}

/**
 * Deserialize hex grid from JSON string
 */
export function deserializeGrid(jsonString: string): HexGrid {
	const data: SerializedGrid = JSON.parse(jsonString)

	// Validate version
	if (data.version !== 1) {
		throw new Error(`Unsupported grid version: ${data.version}`)
	}

	// Create grid with config
	const config: HexGridConfig = {
		width: data.config.width,
		height: data.config.height,
		hexSize: data.config.hexSize,
		offset: k.vec2(data.config.offset.x, data.config.offset.y),
	}
	const grid = new HexGrid(config)

	// Restore cell types
	for (const [key, cellType] of Object.entries(data.cells)) {
		const coord = stringToHex(key)
		grid.setCell(coord, cellType)
	}

	return grid
}

/**
 * Export grid to compact string format for copy/paste
 * Format: WIDTHxHEIGHT|HEXSIZE|OFFSET_X,OFFSET_Y|CELLS
 * CELLS is run-length encoded: type:count,type:count,...
 */
export function exportGridCompact(grid: HexGrid): string {
	const parts: string[] = []

	// Header: width x height | hexSize | offset
	parts.push(`${grid.config.width}x${grid.config.height}`)
	parts.push(`${grid.config.hexSize}`)
	parts.push(`${grid.config.offset.x},${grid.config.offset.y}`)

	// Encode cells with run-length encoding
	const cellsArray = grid.getAllCells()
	let encoded = ""
	let currentType: CellType | null = null
	let count = 0

	for (const cell of cellsArray) {
		if (cell.type === currentType) {
			count++
		} else {
			if (currentType !== null) {
				encoded += `${cellTypeToChar(currentType)}${count},`
			}
			currentType = cell.type
			count = 1
		}
	}

	// Add final run
	if (currentType !== null) {
		encoded += `${cellTypeToChar(currentType)}${count}`
	}

	parts.push(encoded)

	return parts.join("|")
}

/**
 * Import grid from compact string format
 */
export function importGridCompact(compactString: string): HexGrid {
	const parts = compactString.split("|")

	if (parts.length !== 4) {
		throw new Error("Invalid compact grid format")
	}

	// Parse header
	const [widthStr, heightStr] = parts[0].split("x")
	const hexSize = parseInt(parts[1])
	const [offsetX, offsetY] = parts[2].split(",").map(Number)

	// Create grid
	const config: HexGridConfig = {
		width: parseInt(widthStr),
		height: parseInt(heightStr),
		hexSize,
		offset: k.vec2(offsetX, offsetY),
	}

	const grid = new HexGrid(config)

	// Decode cells
	const encoded = parts[3]
	const runs = encoded.split(",")
	const cellsArray = grid.getAllCells()
	let cellIndex = 0

	for (const run of runs) {
		if (!run) continue

		const typeChar = run[0]
		const count = parseInt(run.substring(1))
		const cellType = charToCellType(typeChar)

		for (let i = 0; i < count && cellIndex < cellsArray.length; i++) {
			const cell = cellsArray[cellIndex]
			grid.setCell(cell.coord, cellType)
			cellIndex++
		}
	}

	return grid
}

/**
 * Convert cell type to single character
 */
function cellTypeToChar(type: CellType): string {
	switch (type) {
		case CellType.Empty:
			return "."
		case CellType.Wall:
			return "W"
		case CellType.Obstacle:
			return "O"
		default:
			return "?"
	}
}

/**
 * Convert character to cell type
 */
function charToCellType(char: string): CellType {
	switch (char) {
		case ".":
			return CellType.Empty
		case "W":
			return CellType.Wall
		case "O":
			return CellType.Obstacle
		default:
			return CellType.Empty
	}
}
