import { k, layers } from "../../main"
import { addLayer } from "../actions/layerActions"
import { redrawGrid } from "../rendering/gridRenderer"
import { drawLayerToggles } from "./StatusBar"

/**
 * Create layer bar with Add Layer button
 */
export function createLayerBar(): void {
	// ADD LAYER button
	const addBtn = k.add([
		k.pos(20, 20),
		k.rect(100, 30),
		k.area(),
		k.color(0, 100, 0),
		k.anchor("topleft"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"layerToggle",
	])

	addBtn.add([
		k.text("+ LAYER", { size: 10, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	])

	addBtn.onClick(() => {
		addLayer()
		drawLayerToggles()
		redrawGrid()
	})

	// Layer toggle buttons at top
	drawLayerToggles()
}
