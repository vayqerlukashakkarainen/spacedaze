import { CellType, HexGrid } from "../grid/hexGrid"
import { HexCoord, hexToString } from "../grid/hexCoord"

/**
 * Editor pattern with relative coordinates
 * Patterns are offset-independent and can be injected anywhere
 */
export interface EditorPattern {
	name: string
	width: number // Bounding box width
	height: number // Bounding box height
	cells: Record<string, CellType> // Map of "q,r" -> cellType (relative coords)
}

/**
 * Convert HexGrid to EditorPattern (extracts non-empty cells with relative coords)
 */
export function gridToPattern(grid: HexGrid, name: string): EditorPattern {
	const cells: Record<string, CellType> = {}

	// Find bounding box of non-empty cells
	let minQ = Infinity
	let maxQ = -Infinity
	let minR = Infinity
	let maxR = -Infinity

	for (const cell of grid.getAllCells()) {
		if (cell.type !== CellType.Empty) {
			minQ = Math.min(minQ, cell.coord.q)
			maxQ = Math.max(maxQ, cell.coord.q)
			minR = Math.min(minR, cell.coord.r)
			maxR = Math.max(maxR, cell.coord.r)
		}
	}

	// If no non-empty cells, return empty pattern
	if (minQ === Infinity) {
		return {
			name,
			width: 0,
			height: 0,
			cells: {},
		}
	}

	// Store cells with relative coordinates (offset to 0,0)
	for (const cell of grid.getAllCells()) {
		if (cell.type !== CellType.Empty) {
			const relativeCoord: HexCoord = {
				q: cell.coord.q - minQ,
				r: cell.coord.r - minR,
			}
			cells[hexToString(relativeCoord)] = cell.type
		}
	}

	return {
		name,
		width: maxQ - minQ + 1,
		height: maxR - minR + 1,
		cells,
	}
}

/**
 * Convert EditorPattern to JSON string
 */
export function serializePattern(pattern: EditorPattern): string {
	return JSON.stringify(pattern, null, 2)
}

/**
 * Convert JSON string to EditorPattern
 */
export function deserializePattern(jsonString: string): EditorPattern {
	return JSON.parse(jsonString)
}

/**
 * Save pattern to localStorage
 */
export function savePatternToStorage(pattern: EditorPattern): void {
	const key = `pattern_${pattern.name}`
	localStorage.setItem(key, serializePattern(pattern))
	console.log(`Pattern "${pattern.name}" saved to localStorage`)
}

/**
 * Load pattern from localStorage
 */
export function loadPatternFromStorage(name: string): EditorPattern | null {
	const key = `pattern_${name}`
	const data = localStorage.getItem(key)

	if (!data) {
		console.log(`Pattern "${name}" not found in localStorage`)
		return null
	}

	return deserializePattern(data)
}

/**
 * Get all pattern names from localStorage
 */
export function getAllPatternNames(): string[] {
	const names: string[] = []

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)
		if (key && key.startsWith("pattern_")) {
			names.push(key.replace("pattern_", ""))
		}
	}

	return names
}

/**
 * Delete pattern from localStorage
 */
export function deletePattern(name: string): void {
	const key = `pattern_${name}`
	localStorage.removeItem(key)
	console.log(`Pattern "${name}" deleted from localStorage`)
}
