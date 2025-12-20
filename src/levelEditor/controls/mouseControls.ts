import { k } from "../../main"
import { editorState } from "../state/editorState"
import { paintCell, clearCell, updateHoveredCell } from "../actions/gridActions"
import { updateBrightnessSlider } from "../ui/StatusBar"

/**
 * Setup mouse controls for painting
 */
export function setupMouseControls(): void {
	// Mouse controls for painting
	k.onMousePress((btn) => {
		if (btn === "left") {
			editorState.mouse.isDown = true
			paintCell()
		} else if (btn === "right") {
			editorState.mouse.isRightDown = true
			clearCell()
		}
	})

	k.onMouseRelease((btn) => {
		if (btn === "left") {
			editorState.mouse.isDown = false
		} else if (btn === "right") {
			editorState.mouse.isRightDown = false
		}
	})

	k.onMouseMove(() => {
		updateHoveredCell()
		if (editorState.mouse.isDown) {
			paintCell()
		} else if (editorState.mouse.isRightDown) {
			clearCell()
		}
		updateBrightnessSlider()
	})
}
