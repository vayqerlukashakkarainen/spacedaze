import { k, layers } from "../../main";
import { addLayer } from "../actions/layerActions";
import { redrawGrid } from "../rendering/gridRenderer";
import { drawLayerToggles } from "./StatusBar";
import { createUiButton } from "../../ui/common/button";
import { tags } from "../../tags";

/**
 * Create layer bar with Add Layer button
 */
export function createLayerBar(): void {
	// ADD LAYER button
	const addBtn = createUiButton({
		pos: k.vec2(20, 20),
		txt: "+ LAYER",
		size: k.vec2(100, 30),
		color: { r: 0, g: 100, b: 0 },
		tags: [tags.levelEditor, tags.layerToggle],
		onClick: () => {
			addLayer();
			drawLayerToggles();
			redrawGrid();
		},
	});

	// Layer toggle buttons at top
	drawLayerToggles();
}
