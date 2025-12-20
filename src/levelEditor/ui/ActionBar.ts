import { Vec2 } from "kaplay"
import { k, layers, changeGameState, GameState } from "../../main"
import { clearGrid } from "../actions/gridActions"
import { savePattern, loadPattern, exportPatternJSON } from "../actions/patternActions"
import { toggleOutlines } from "../actions/layerActions"

/**
 * Create action button bar (right side)
 */
export function createActionBar(paletteX: number, startY: number, screenHeight: number): void {
	let paletteY = startY

	k.add([
		k.text("ACTIONS", { size: 16, font: "unscii" }),
		k.pos(paletteX, paletteY),
		k.anchor("center"),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	])
	paletteY += 40

	addActionButton("CLEAR", k.vec2(paletteX, paletteY), clearGrid)
	paletteY += 60

	addActionButton("SAVE", k.vec2(paletteX, paletteY), savePattern)
	paletteY += 60

	addActionButton("LOAD", k.vec2(paletteX, paletteY), loadPattern)
	paletteY += 60

	addActionButton("EXPORT JSON", k.vec2(paletteX, paletteY), exportPatternJSON)
	paletteY += 60

	addActionButton("OUTLINES", k.vec2(paletteX, paletteY), toggleOutlines)
	paletteY += 80

	// Exit button
	addActionButton("EXIT", k.vec2(paletteX, screenHeight - 60), () => {
		changeGameState(GameState.MainMenu)
	})
}

/**
 * Add action button
 */
function addActionButton(txt: string, pos: Vec2, onClick: () => void) {
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
	])

	btn.add([
		k.text(txt, { size: 12, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	])

	btn.onClick(onClick)

	return btn
}
