import { hexCoord } from "../../grid/hexCoord"
import { editorState } from "../state/editorState"
import { redrawGrid } from "../rendering/gridRenderer"
import {
	gridToPattern,
	serializePattern,
	savePatternToStorage,
	loadPatternFromStorage,
	getAllPatternNames,
} from "../editorPatterns"
import { clearGrid } from "./gridActions"

/**
 * Save pattern to localStorage
 */
export function savePattern(): void {
	if (!editorState.grid) return

	const name = prompt("Enter pattern name:", "my_pattern")
	if (!name) return

	const pattern = gridToPattern(editorState.grid, name)
	savePatternToStorage(pattern)

	console.log(`Pattern "${name}" saved!`)
	console.log(`Size: ${pattern.width}x${pattern.height}`)
	console.log(`Cells: ${Object.keys(pattern.cells).length}`)
}

/**
 * Load pattern from localStorage
 */
export function loadPattern(): void {
	const names = getAllPatternNames()

	if (names.length === 0) {
		console.log("No saved patterns found")
		alert("No saved patterns found")
		return
	}

	const name = prompt(
		`Enter pattern name to load:\n\nAvailable: ${names.join(", ")}`,
		names[0]
	)
	if (!name) return

	const pattern = loadPatternFromStorage(name)
	if (!pattern) {
		alert(`Pattern "${name}" not found`)
		return
	}

	// Load pattern into grid
	if (!editorState.grid) return

	clearGrid()

	for (const [coordStr, cellType] of Object.entries(pattern.cells)) {
		const [q, r] = coordStr.split(",").map(Number)
		const coord = hexCoord(q, r)
		if (editorState.grid.inBounds(coord)) {
			editorState.grid.setCell(coord, cellType)
		}
	}

	redrawGrid()
	console.log(`Pattern "${name}" loaded!`)
}

/**
 * Export pattern as JSON to clipboard
 */
export function exportPatternJSON(): void {
	if (!editorState.grid) return

	const name = prompt("Enter pattern name for export:", "my_pattern")
	if (!name) return

	const pattern = gridToPattern(editorState.grid, name)
	const json = serializePattern(pattern)

	// Copy to clipboard
	navigator.clipboard.writeText(json).then(
		() => {
			console.log("Pattern JSON copied to clipboard!")
			alert("Pattern JSON copied to clipboard!")
			console.log(json)
		},
		() => {
			console.log("Failed to copy to clipboard, logging JSON:")
			console.log(json)
			alert("Check console for JSON output")
		}
	)
}
