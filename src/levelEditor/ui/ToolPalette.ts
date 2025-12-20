import { Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { CellType } from "../../grid/hexGrid"
import { editorState, setCurrentTool } from "../state/editorState"
import { updateToolLabel } from "./StatusBar"

/**
 * Create tool palette UI (right side)
 */
export function createToolPalette(paletteX: number, startY: number): number {
	let paletteY = startY

	k.add([
		k.text("TOOLS", { size: 16, font: "unscii" }),
		k.pos(paletteX, paletteY),
		k.anchor("center"),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	])
	paletteY += 40

	// Tool buttons
	addToolButton("EMPTY (E)", k.vec2(paletteX, paletteY), CellType.Empty)
	paletteY += 60

	addToolButton("WALL (W)", k.vec2(paletteX, paletteY), CellType.Wall)
	paletteY += 60

	addToolButton("OBSTACLE (O)", k.vec2(paletteX, paletteY), CellType.Obstacle)
	paletteY += 80

	return paletteY
}

/**
 * Add tool selection button
 */
function addToolButton(txt: string, pos: Vec2, tool: CellType) {
	const btn = k.add([
		k.pos(pos),
		k.rect(120, 40),
		k.area(),
		k.color(0, 0, 0),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"toolButton",
		{ tool },
	])

	btn.add([
		k.text(txt, { size: 12, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	])

	btn.onClick(() => {
		setCurrentTool(tool)
		updateToolLabel()
		highlightSelectedTool()
	})

	// Highlight if current tool
	if (editorState.currentTool === tool) {
		btn.outline.color = new k.Color(255, 255, 0)
		btn.outline.width = 3
	}

	return btn
}

/**
 * Highlight the selected tool button
 */
export function highlightSelectedTool(): void {
	const buttons = k.get("toolButton")

	for (const btn of buttons) {
		if ("tool" in btn && btn.outline) {
			if (btn.tool === editorState.currentTool) {
				btn.outline.color = new k.Color(255, 255, 0)
				btn.outline.width = 3
			} else {
				btn.outline.color = new k.Color(255, 255, 255)
				btn.outline.width = 2
			}
		}
	}
}
