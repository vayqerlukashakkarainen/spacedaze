import { k, layers } from "../../main"
import { editorState } from "../state/editorState"
import { setLayerBrightness } from "../actions/layerActions"
import { toggleLayerVisibility, switchToLayer } from "../actions/layerActions"

/**
 * Create status bar UI at bottom of screen
 */
export function createStatusBar(): void {
	const screenWidth = k.width()
	const screenHeight = k.height()

	// Zoom label
	k.add([
		k.text(`Zoom: ${Math.round(editorState.camera.zoom * 100)}%`, {
			size: 12,
			font: "unscii",
		}),
		k.pos(20, screenHeight - 120),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"zoomLabel",
	])

	// Grid size label
	k.add([
		k.text(
			`Grid Size: ${editorState.gridSize.width}x${editorState.gridSize.height}`,
			{
				size: 12,
				font: "unscii",
			}
		),
		k.pos(20, screenHeight - 100),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"sizeLabel",
	])

	// Layer label
	k.add([
		k.text(`Layer: ${editorState.currentLayer + 1}/${editorState.grid?.layers || 1}`, {
			size: 12,
			font: "unscii",
		}),
		k.pos(20, screenHeight - 80),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"layerLabel",
	])

	// Help text
	k.add([
		k.text("Shift+Arrows: Resize  R: Apply  [/]: Switch Layer  WASD: Camera", {
			size: 10,
			font: "unscii",
		}),
		k.pos(20, screenHeight - 60),
		k.color(200, 200, 200),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	])

	// Current tool indicator (bottom center)
	k.add([
		k.text(`Tool: ${editorState.currentTool.toUpperCase()}`, {
			size: 12,
			font: "unscii",
		}),
		k.pos(screenWidth / 2, screenHeight - 60),
		k.anchor("center"),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"toolLabel",
	])
}

/**
 * Update tool label
 */
export function updateToolLabel(): void {
	const label = k.get("toolLabel")[0]
	if (label && "text" in label) {
		label.text = `Tool: ${editorState.currentTool.toUpperCase()}`
	}
}

/**
 * Update size label
 */
export function updateSizeLabel(): void {
	const label = k.get("sizeLabel")[0]
	if (label && "text" in label) {
		label.text = `Grid Size: ${editorState.gridSize.width}x${editorState.gridSize.height}`
	}
}

/**
 * Update layer label
 */
export function updateLayerLabel(): void {
	const label = k.get("layerLabel")[0]
	if (label && "text" in label && editorState.grid) {
		label.text = `Layer: ${editorState.currentLayer + 1}/${editorState.grid.layers}`
	}
}

/**
 * Update zoom label
 */
export function updateZoomLabel(): void {
	const label = k.get("zoomLabel")[0]
	if (label && "text" in label) {
		label.text = `Zoom: ${Math.round(editorState.camera.zoom * 100)}%`
	}
}

/**
 * Create brightness slider UI
 */
export function createBrightnessSlider(): void {
	const sliderY = 60
	const sliderX = 20
	const sliderWidth = 150

	k.add([
		k.text("Brightness:", { size: 10, font: "unscii" }),
		k.pos(sliderX, sliderY),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	])

	// Slider track
	k.add([
		k.rect(sliderWidth, 4),
		k.pos(sliderX, sliderY + 15),
		k.color(100, 100, 100),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	])

	// Slider handle
	editorState.ui.brightnessSlider = k.add([
		k.rect(8, 16),
		k.pos(
			sliderX + sliderWidth * editorState.layers[editorState.currentLayer].brightness,
			sliderY + 15 - 6
		),
		k.color(255, 255, 255),
		k.anchor("center"),
		k.area(),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"brightnessSlider",
	])

	// Brightness value label
	k.add([
		k.text(
			`${Math.round(editorState.layers[editorState.currentLayer].brightness * 100)}%`,
			{
				size: 10,
				font: "unscii",
			}
		),
		k.pos(sliderX + sliderWidth + 10, sliderY + 15),
		k.color(255, 255, 255),
		k.anchor("left"),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
		"brightnessLabel",
	])
}

/**
 * Update brightness slider position and label
 */
export function updateBrightnessSlider(): void {
	const sliderY = 60 + 15
	const sliderX = 20
	const sliderWidth = 150

	// Check if mouse is dragging the slider
	if (k.isMouseDown("left") && editorState.ui.brightnessSlider) {
		const mousePos = k.mousePos()
		const sliderBounds = {
			x: sliderX,
			y: sliderY - 8,
			width: sliderWidth,
			height: 20,
		}

		// Check if mouse is near slider
		if (
			mousePos.x >= sliderBounds.x &&
			mousePos.x <= sliderBounds.x + sliderBounds.width &&
			mousePos.y >= sliderBounds.y &&
			mousePos.y <= sliderBounds.y + sliderBounds.height
		) {
			// Update brightness based on mouse position
			const newBrightness = k.clamp((mousePos.x - sliderX) / sliderWidth, 0, 1)
			setLayerBrightness(editorState.currentLayer, newBrightness)

			// Update slider handle position
			editorState.ui.brightnessSlider.pos.x = sliderX + sliderWidth * newBrightness

			// Update brightness label
			const brightnessLabel = k.get("brightnessLabel")[0]
			if (brightnessLabel && "text" in brightnessLabel) {
				brightnessLabel.text = `${Math.round(newBrightness * 100)}%`
			}
		}
	}
}

/**
 * Update brightness slider position when changing layers
 */
export function updateBrightnessSliderPosition(): void {
	const sliderY = 60 + 15
	const sliderX = 20
	const sliderWidth = 150

	if (editorState.ui.brightnessSlider) {
		editorState.ui.brightnessSlider.pos.x =
			sliderX + sliderWidth * editorState.layers[editorState.currentLayer].brightness
	}

	const brightnessLabel = k.get("brightnessLabel")[0]
	if (brightnessLabel && "text" in brightnessLabel) {
		brightnessLabel.text = `${Math.round(editorState.layers[editorState.currentLayer].brightness * 100)}%`
	}
}

/**
 * Create layer toggle buttons
 */
export function drawLayerToggles(): void {
	if (!editorState.grid) return

	const buttonWidth = 80
	const buttonHeight = 30
	const spacing = 10
	const startX = 20
	const startY = 20

	// Add new layer toggle buttons for layers that don't have buttons yet
	for (let i = editorState.ui.layerToggleButtons.length; i < editorState.grid.layers; i++) {
		const x = startX + (buttonWidth + spacing) * (i + 1)

		const btn = k.add([
			k.pos(x, startY),
			k.rect(buttonWidth, buttonHeight),
			k.area(),
			k.color(100, 100, 100),
			k.anchor("topleft"),
			k.outline(2, new k.Color(255, 255, 255)),
			k.fixed(),
			k.layer(layers.ui),
			"levelEditor",
			"layerToggle",
		])

		const label = btn.add([
			k.text(`L${i + 1}`, {
				size: 10,
				font: "unscii",
			}),
			k.anchor("center"),
			k.color(255, 255, 255),
		])

		btn.onClick(() => {
			toggleLayerVisibility(i)
			updateLayerToggles()
		})

		// Right click to set as active layer
		btn.onMousePress((button) => {
			if (button === "right") {
				switchToLayer(i)
				updateLayerLabel()
				updateLayerToggles()
				updateBrightnessSliderPosition()
			}
		})

		editorState.ui.layerToggleButtons.push({ btn, label })
	}

	// Update existing buttons
	updateLayerToggles()
}

/**
 * Update layer toggle button appearance based on state
 */
export function updateLayerToggles(): void {
	for (let i = 0; i < editorState.ui.layerToggleButtons.length; i++) {
		const { btn, label } = editorState.ui.layerToggleButtons[i]
		const isVisible = editorState.layers[i].isVisible
		const isActive = i === editorState.currentLayer

		// Update color
		const colorValue = isVisible ? 100 : 30
		btn.color = k.rgb(colorValue, colorValue, colorValue)

		// Update outline
		btn.outline.width = isActive ? 3 : 2
		btn.outline.color = isActive
			? new k.Color(255, 255, 0)
			: new k.Color(255, 255, 255)

		// Update text
		label.text = `L${i + 1}${isVisible ? "" : " OFF"}`
	}
}
