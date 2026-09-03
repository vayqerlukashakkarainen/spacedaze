import { k } from "../main";
import { createUiLabel } from "../ui/common/label";
import { GameObj, TextComp } from "kaplay";
import { tags } from "../tags";
import { getFrameProfilerSnapshot } from "../services/frameProfilerService";

let debugVisible = true;
let debugLabels: {
	performance?: GameObj<TextComp>;
} = {};
let refreshElapsed = 0;

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

	debugLabels.performance = createUiLabel({
		pos: k.vec2(startX - 45, 34),
		txt: "",
		fontSize: 9,
		color: k.Color.fromHex("#ffffff"),
	});
}

/**
 * Update debug information
 */
export function updateDebug() {
	if (!debugVisible) return;
	refreshElapsed += k.dt();
	if (refreshElapsed < 0.2) return;
	refreshElapsed = 0;

	if (debugLabels.performance && "text" in debugLabels.performance) {
		const snapshot = getFrameProfilerSnapshot();
		const gameLoop = snapshot.sections.gameLoop ?? 0;
		const gridVisibility = snapshot.sections.gridVisibility ?? 0;
		debugLabels.performance.text = [
			`FPS ${Math.round(k.debug.fps())}`,
			`Frame avg ${formatMs(snapshot.frameAverage)}  p95 ${formatMs(snapshot.frameP95)}`,
			`Frame max ${formatMs(snapshot.frameMax)}  Draws ${k.debug.drawCalls()}`,
			`Enemies ${k.get(tags.enemy).length}  Projectiles ${k.get(tags.projectile).length}`,
			`Debris ${k.get(tags.debree).length}  Run map ${k.get(tags.runMap).length}`,
			`CPU game ${formatMs(gameLoop)}  grid ${formatMs(gridVisibility)}`,
		].join("\n");
	}
}

function formatMs(value: number) {
	return `${value.toFixed(2)}ms`;
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
