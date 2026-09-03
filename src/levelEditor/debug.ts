import { k, layers } from "../main";
import { createUiLabel } from "../ui/common/label";
import { GameObj, TextComp } from "kaplay";
import { uiState } from "../ui/uiState";

let debugVisible = true;
let debugLabels: {
	fps?: GameObj<TextComp>;
	objects?: GameObj<TextComp>;
	overUi?: GameObj<TextComp>;
} = {};

/**
 * Initialize debug UI
 */
export function initDebug() {
	debugVisible = true;
	createDebugLabels();

	// Toggle debug with F1
	k.onKeyPress("f1", () => {
		toggleDebug();
	});
}

/**
 * Create debug labels
 */
function createDebugLabels() {
	const screenWidth = k.width();
	const startX = screenWidth - 150;
	let startY = 20;

	// FPS label
	debugLabels.fps = createUiLabel({
		pos: k.vec2(startX, startY),
		txt: "FPS: 0",
		color: k.Color.fromHex("#ffffff"),
	});
	startY += 20;

	// Object count label
	debugLabels.objects = createUiLabel({
		pos: k.vec2(startX, startY),
		txt: "Objects: 0",
		color: k.Color.fromHex("#ffffff"),
	});

	startY += 20;

	// Object count label
	debugLabels.overUi = createUiLabel({
		pos: k.vec2(startX, startY),
		txt: "Over UI: 0",
		color: k.Color.fromHex("#ffffff"),
	});
}

/**
 * Update debug information
 */
export function updateDebug() {
	if (!debugVisible) return;

	// Update FPS
	const fps = Math.round(1 / k.dt());
	if (debugLabels.fps && "text" in debugLabels.fps) {
		debugLabels.fps.text = `FPS: ${fps}`;
	}

	// Update object count
	const objectCount = k.debug.numObjects();
	if (debugLabels.objects && "text" in debugLabels.objects) {
		debugLabels.objects.text = `Objects: ${objectCount}`;
	}

	if (debugLabels.overUi && "text" in debugLabels.overUi) {
		debugLabels.overUi.text = `Over UI: ${uiState.isOverUI}`;
	}
}

/**
 * Toggle debug visibility
 */
export function setDebugVisible(visible: boolean) {
	debugVisible = visible;

	for (const label of Object.values(debugLabels)) {
		if (label) label.hidden = !debugVisible;
	}

	return debugVisible;
}

export function toggleDebug() {
	return setDebugVisible(!debugVisible);
}

export function debugIsVisible() {
	return debugVisible;
}

/**
 * Cleanup debug UI
 */
export function cleanupDebug() {
	k.destroyAll("debug");
	debugLabels = {};
}
