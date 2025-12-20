import { k, layers } from "../main";
import { GameObj, TextComp } from "kaplay";

let debugVisible = true;
let debugLabels: {
	fps?: GameObj<TextComp>;
	objects?: GameObj<TextComp>;
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
	debugLabels.fps = k.add([
		k.text("FPS: 0", { size: 12, font: "unscii" }),
		k.pos(startX, startY),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"debug",
	]);
	startY += 20;

	// Object count label
	debugLabels.objects = k.add([
		k.text("Objects: 0", { size: 12, font: "unscii" }),
		k.pos(startX, startY),
		k.color(255, 255, 255),
		k.fixed(),
		k.layer(layers.ui),
		"debug",
	]);
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
	const objectCount = k.get("*").length;
	if (debugLabels.objects && "text" in debugLabels.objects) {
		debugLabels.objects.text = `Objects: ${objectCount}`;
	}
}

/**
 * Toggle debug visibility
 */
function toggleDebug() {
	debugVisible = !debugVisible;

	// Update opacity for all debug labels
	for (const label of Object.values(debugLabels)) {
		if (label && "opacity" in label) {
			label.hidden = debugVisible;
		}
	}

	console.log(`Debug: ${debugVisible ? "ON" : "OFF"}`);
}

/**
 * Cleanup debug UI
 */
export function cleanupDebug() {
	k.destroyAll("debug");
	debugLabels = {};
}
