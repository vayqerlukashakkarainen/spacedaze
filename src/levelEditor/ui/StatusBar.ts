import { k, layers } from "../../main";
import { editorState } from "../state/editorState";
import { setLayerBrightness } from "../actions/layerActions";
import { toggleLayerVisibility, switchToLayer } from "../actions/layerActions";
import { createUiLabel } from "../../ui/common/label";
import { createSlider } from "../../ui/common/slider";
import { tags } from "../../tags";
import { uiHitRegion } from "../../ui/common/hitRegion";

/**
 * Create status bar UI at bottom of screen
 */
export function createStatusBar(): void {
	const screenWidth = k.width();
	const screenHeight = k.height();

	// Zoom label
	createUiLabel({
		pos: k.vec2(20, screenHeight - 120),
		txt: `Zoom: ${Math.round(editorState.camera.zoom * 100)}%`,
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor, "zoomLabel"],
	});

	// Grid size label
	createUiLabel({
		pos: k.vec2(20, screenHeight - 100),
		txt: `Grid Size: ${editorState.gridSize.width}x${editorState.gridSize.height}`,
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor, "sizeLabel"],
	});

	// Layer label
	createUiLabel({
		pos: k.vec2(20, screenHeight - 80),
		txt: `Layer: ${editorState.currentLayer + 1}/${editorState.grid?.layers || 1}`,
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor, "layerLabel"],
	});

	// Help text
	createUiLabel({
		pos: k.vec2(20, screenHeight - 60),
		txt: "Shift+Arrows: Resize  R: Apply  [/]: Switch Layer  WASD: Camera",
		color: k.Color.fromHex("#c8c8c8"),
		tags: [tags.levelEditor, "helpLabel"],
	});

	// Current tool indicator (bottom center)
	createUiLabel({
		pos: k.vec2(screenWidth / 2, screenHeight - 60),
		txt: `Tool: ${editorState.currentTool.toUpperCase()}`,
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor, "toolLabel"],
	});
}

/**
 * Update tool label
 */
export function updateToolLabel(): void {
	const label = k.get("toolLabel")[0];
	if (label && "text" in label) {
		if (editorState.currentTool === "spawn") {
			label.text = `Tool: SPAWN`;
		} else {
			label.text = `Tool: ${editorState.currentTool.toUpperCase()}`;
		}
	}
}

/**
 * Update size label
 */
export function updateSizeLabel(): void {
	const label = k.get("sizeLabel")[0];
	if (label && "text" in label) {
		label.text = `Grid Size: ${editorState.gridSize.width}x${editorState.gridSize.height}`;
	}
}

/**
 * Update layer label
 */
export function updateLayerLabel(): void {
	const label = k.get("layerLabel")[0];
	if (label && "text" in label && editorState.grid) {
		label.text = `Layer: ${editorState.currentLayer + 1}/${editorState.grid.layers}`;
	}
}

/**
 * Update zoom label
 */
export function updateZoomLabel(): void {
	const label = k.get("zoomLabel")[0];
	if (label && "text" in label) {
		label.text = `Zoom: ${Math.round(editorState.camera.zoom * 100)}%`;
	}
}

/**
 * Create brightness slider UI
 */
export function createBrightnessSlider(): void {
	const sliderY = 60;
	const sliderX = 20;
	const sliderWidth = 150;

	createUiLabel({
		pos: k.vec2(sliderX, sliderY),
		txt: "Brightness:",
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor],
	});

	// Create slider
	const slider = createSlider({
		pos: k.vec2(sliderX, sliderY + 15),
		width: sliderWidth,
		value: editorState.layers[editorState.currentLayer].brightness,
		onChange: (value) => {
			setLayerBrightness(editorState.currentLayer, value);
			// Update brightness label
			const brightnessLabel = k.get(tags.brightnessSlider)[0];
			if (brightnessLabel && "text" in brightnessLabel) {
				brightnessLabel.text = `${Math.round(value * 100)}%`;
			}
		},
		tags: [tags.levelEditor, tags.brightnessSlider],
	});

	// Store reference to slider handle for updates
	editorState.ui.brightnessSlider = slider.handle;

	// Brightness value label
	createUiLabel({
		pos: k.vec2(sliderX + sliderWidth + 10, sliderY + 15),
		txt: `${Math.round(editorState.layers[editorState.currentLayer].brightness * 100)}%`,
		color: k.Color.fromHex("#ffffff"),
		tags: [tags.levelEditor, tags.brightnessSlider],
	});
}

/**
 * Create layer toggle buttons
 */
export function drawLayerToggles(): void {
	if (!editorState.grid) return;

	const buttonWidth = 80;
	const buttonHeight = 30;
	const spacing = 10;
	const startX = 20;
	const startY = 20;

	// Add new layer toggle buttons for layers that don't have buttons yet
	for (
		let i = editorState.ui.layerToggleButtons.length;
		i < editorState.grid.layers;
		i++
	) {
		const x = startX + (buttonWidth + spacing) * (i + 1);

		const btn = k.add([
			k.pos(x, startY),
			k.rect(buttonWidth, buttonHeight),
			uiHitRegion(k.vec2(buttonWidth, buttonHeight), true),
			k.color(100, 100, 100),
			k.anchor("center"),
			k.outline(2, new k.Color(255, 255, 255)),
			k.fixed(),
			k.layer(layers.ui),
			tags.levelEditor,
			tags.layerToggle,
		]);

		const label = btn.add([
			k.text(`L${i + 1}`, {
				size: 10,
				font: "unscii",
			}),
			k.anchor("center"),
			k.color(255, 255, 255),
		]);

		btn.onClick(() => {
			toggleLayerVisibility(i);
			updateLayerToggles();
		});

		// Right click to set as active layer
		btn.onMousePress((button) => {
			if (button === "right") {
				switchToLayer(i);
				updateLayerLabel();
				updateLayerToggles();
			}
		});

		editorState.ui.layerToggleButtons.push({ btn, label });
	}

	// Update existing buttons
	updateLayerToggles();
}

/**
 * Update layer toggle button appearance based on state
 */
export function updateLayerToggles(): void {
	for (let i = 0; i < editorState.ui.layerToggleButtons.length; i++) {
		const { btn, label } = editorState.ui.layerToggleButtons[i];
		const isVisible = editorState.layers[i].isVisible;
		const isActive = i === editorState.currentLayer;

		// Update color
		const colorValue = isVisible ? 100 : 30;
		btn.color = k.rgb(colorValue, colorValue, colorValue);

		// Update outline
		btn.outline.width = isActive ? 3 : 2;
		btn.outline.color = isActive
			? new k.Color(255, 255, 0)
			: new k.Color(255, 255, 255);

		// Update text
		label.text = `L${i + 1}${isVisible ? "" : " OFF"}`;
	}
}
