import { k, layers } from "../main";
import { GameObj, TextComp } from "kaplay";
import { tags } from "../tags";
import {
	getFrameProfilerSnapshot,
	setFrameProfilerEnabled,
} from "../services/frameProfilerService";
import { getPerformanceBenchmarkStatus } from "../services/performanceBenchmarkService";

let debugVisible = false;
let debugLabels: {
	performance?: GameObj<TextComp>;
} = {};
let refreshElapsed = 0;
const DEBUG_REFRESH_INTERVAL = 0.25;

/**
 * Initialize debug UI
 */
export function initDebug() {
	debugVisible = false;
	createDebugLabels();
	setDebugVisible(false);

	// Toggle debug with F1
	k.onKeyPress("f1", () => {
		toggleDebug();
	});
}

/**
 * Create debug labels
 */
function createDebugLabels() {
	debugLabels.performance = k.add([
		k.text("", { size: 8, font: "unscii", lineSpacing: 1 }),
		k.pos(12, 12),
		k.anchor("topleft"),
		k.color(k.WHITE),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(1000),
		"debug",
	]);
}

/**
 * Update debug information
 */
export function updateDebug() {
	if (!debugVisible) return;
	refreshElapsed += k.dt();
	if (refreshElapsed < DEBUG_REFRESH_INTERVAL) return;
	refreshElapsed = 0;

	if (debugLabels.performance && "text" in debugLabels.performance) {
		const snapshot = getFrameProfilerSnapshot();
		const objectStats = collectDebugObjectStats();
		const gameLoop = snapshot.sections.gameLoop ?? 0;
		const gridVisibility = snapshot.sections.gridVisibility ?? 0;
		const projectileUpdate = snapshot.sections.projectiles ?? 0;
		const backgroundUpdate = snapshot.sections["external:background"] ??
			(snapshot.sections.background ?? 0);
		const wallDraw = snapshot.sections.wallDraw ?? 0;
		const rootUpdate = snapshot.sections.rootUpdate ?? 0;
		const centralRunLoop = snapshot.sections.centralRunLoop ?? 0;
		const externalUpdateCpu = Object.entries(snapshot.sections)
			.filter(([name]) => name.startsWith("external:"))
			.reduce((total, [, value]) => total + value, 0);
		const centralPhaseCpu = Object.entries(snapshot.sections)
			.filter(([name]) => name.startsWith("phase:"))
			.reduce((total, [, value]) => total + value, 0);
		const externalSectionNames = [
			"projectiles",
			"external:background",
			"wallDraw",
			"uiPopover",
			"uiHud",
			"uiTacticalMap",
			"uiEffectsUpdate",
			"uiEffectsDraw",
		];
		const externalCpu = externalSectionNames.reduce(
			(total, name) => total + (snapshot.sections[name] ?? 0),
			0
		);
		const uiCpu = (snapshot.sections["phase:ui"] ?? 0) +
			externalSectionNames
				.filter((name) => name.startsWith("ui"))
				.reduce((total, name) => total + (snapshot.sections[name] ?? 0), 0);
		const knownCpu = centralPhaseCpu > 0
			? centralPhaseCpu + externalCpu
			: Object.values(snapshot.sections)
				.reduce((total, value) => total + value, 0);
		const measuredUpdateCpu = rootUpdate + externalUpdateCpu;
		const frameRemainder = Math.max(0, snapshot.frameAverage - measuredUpdateCpu);
		const benchmark = getPerformanceBenchmarkStatus();
		debugLabels.performance.text = [
			`FPS ${Math.round(k.debug.fps())}  Draws ${k.debug.drawCalls()}  Objects ${k.debug.numObjects()}`,
			`Frame avg ${formatMs(snapshot.frameAverage)}  p95 ${formatMs(snapshot.frameP95)}`,
			`Frame max ${formatMs(snapshot.frameMax)}  Update ${formatMs(measuredUpdateCpu)}  Idle/render ${formatMs(frameRemainder)}`,
			`Root ${formatMs(rootUpdate)}  run loop ${formatMs(centralRunLoop)}  external ${formatMs(externalUpdateCpu)}  sections ${formatMs(knownCpu)}`,
			`CPU game ${formatMs(gameLoop)}  grid ${formatMs(gridVisibility)}  projectiles ${formatMs(projectileUpdate)}`,
			`CPU walls ${formatMs(wallDraw)}  background ${formatMs(backgroundUpdate)}  UI ${formatMs(uiCpu)}`,
			`Phases move ${formatMs(snapshot.sections["phase:movement"] ?? 0)}  spatial ${formatMs(snapshot.sections["phase:spatialIndex"] ?? 0)}  collision ${formatMs(snapshot.sections["phase:collision"] ?? 0)}`,
			`Spatial objects ${snapshot.counters.spatialObjects ?? 0}  cells ${snapshot.counters.spatialCells ?? 0}`,
			`Enemies ${objectStats.enemies}  Projectiles ${objectStats.projectiles}`,
			`Debris ${objectStats.debris}  Run map ${objectStats.runMap}`,
			`UI objects ${objectStats.ui}  Areas ${objectStats.areas}  Hit regions ${snapshot.counters.uiPointerRegions ?? 0}  Text ${objectStats.text}  Masks ${objectStats.masks}  Emitters ${objectStats.emitters}`,
			`Primitives walls ${snapshot.counters.wallPrimitives ?? 0}  UI FX ${snapshot.counters.uiEffectPrimitives ?? 0}`,
			`Batches enemies ${snapshot.counters["batch:enemies:count"] ?? 0}  followers ${snapshot.counters["batch:followers:count"] ?? 0}  debris ${snapshot.counters["batch:debris:count"] ?? 0}  world ${snapshot.counters["batch:world:count"] ?? 0}  FX ${snapshot.counters["batch:effects:count"] ?? 0}`,
			`UI batches ${snapshot.counters["batch:ui:count"] ?? 0}  HUD ${snapshot.counters["batch:ui:hud:count"] ?? 0}  overlays ${snapshot.counters["batch:ui:overlay:count"] ?? 0}  modal ${snapshot.counters["batch:ui:modal:count"] ?? 0}  menu ${snapshot.counters["batch:ui:menu:count"] ?? 0}`,
			benchmark
				? `Benchmark ${benchmark.name} ${benchmark.elapsed.toFixed(1)}/${benchmark.duration.toFixed(1)}s`
				: `Samples ${snapshot.frameSampleCount}`,
		].join("\n");
	}
}

function collectDebugObjectStats() {
	const stats = {
		enemies: 0,
		projectiles: 0,
		debris: 0,
		runMap: 0,
		ui: 0,
		areas: 0,
		text: 0,
		masks: 0,
		emitters: 0,
	};
	for (const obj of k.get<GameObj>("*", { recursive: true })) {
		const objectLayer = (obj as GameObj & { layer?: string }).layer;
		if (objectLayer === layers.ui || objectLayer === layers.uiEffects) stats.ui++;
		if (obj.has("area")) stats.areas++;
		if (obj.has("text")) stats.text++;
		if (obj.has("mask")) stats.masks++;
		if (obj.has("particles")) stats.emitters++;
		if (obj.is(tags.enemy)) stats.enemies++;
		if (obj.is(tags.projectile)) stats.projectiles++;
		if (obj.is(tags.debree)) stats.debris++;
		if (obj.is(tags.runMap)) stats.runMap++;
	}
	return stats;
}

function formatMs(value: number) {
	return `${value.toFixed(2)}ms`;
}

/**
 * Toggle debug visibility
 */
export function setDebugVisible(visible: boolean) {
	debugVisible = visible;
	if (visible) setFrameProfilerEnabled(true);

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
