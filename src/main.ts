import kaplay, { GameObj, Vec2 } from "kaplay";
import { init, loadGame } from "./util";
import { startGame, updateGameLoop } from "./game";
import { enterMainMenu, updateMainMenuLoop } from "./ui/mainMenu";
import { setLoadout } from "./upg";
import { loadPlayer } from "./player";
import { initParticles, initUiEffects } from "./particles";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { upgradeService } from "./services/upgradeService";
import { spawnTimescaleZone } from "./spawn/spawnTimescaleZone";
import { spawnRing } from "./spawn/spawnRing";
import { startChestOpeningSequence } from "./ui/chestOpening";
import { generateCave } from "./generation/caveGenerator";
import { generationMapToHexGrid } from "./generation/gridConversion";
import { runHexGridTests } from "./grid/hexGrid.test";
import { tags } from "./tags";
import { enterLevelEditor, updateLevelEditor } from "./levelEditor/levelEditor";
import { setupStatsWindow } from "./ui/statsWindow";
import { initDebug, updateDebug } from "./levelEditor/debug";
import { gridRegistry } from "./grid/gridRegistry";

export const layers = {
	bg: "bg",
	game2: "game2",
	game: "game",
	ui: "ui",
	uiEffects: "uiEffects",
};

export const GameState = {
	MainMenu: 0,
	Playing: 1,
	LevelEditor: 2,
	ChestOpening: 3,
};

const borderOffset = -22;
export let score = 60;
export const BULLET_SPEED = 320;
export const ROCKET_SPEED = 280;
export let timeSeconds = 0;
export const outsideBorderPos: Vec2[] = [];

export const subSoundVolume = 0.3;
export const mainSoundVolume = 0.5;
export const musicVolume = 0.6;

let gameState = GameState.Playing;
let isPaused = false;
export let timeScale = 1;
let targetTimeScale = 1;
let startTimeScale = 1;
let timescaleLerpDuration = 0.3; // seconds
let timescaleLerpProgress = 0;

export const k = kaplay({
	background: "#000000",
	global: false,
	scale: 1,
});

export function dt() {
	return k.dt() * timeScale;
}
export function dtScaled() {
	return dt() * 100;
}

/**
 * Set the target timescale with smooth lerping
 * @param target - The target timescale value
 * @param duration - Duration of the lerp in seconds (default: 0.3)
 */
export function setTimescale(target: number, duration: number = 0.3) {
	startTimeScale = timeScale;
	targetTimeScale = target;
	timescaleLerpDuration = duration;
	timescaleLerpProgress = 0;
}

init(k).then(() => {
	initParticles();
	initUiEffects();
	upgradeService.initialize();
	loadGameSlot();
	setupStatsWindow();
	initDebug();
	k.setLayers(
		[layers.bg, layers.game2, layers.game, layers.ui, layers.uiEffects],
		layers.game
	);

	addBorderOffsets();

	changeGameState(GameState.MainMenu);

	k.onUpdate(() => {
		// Update debug info
		updateDebug();

		// Lerp timescale towards target
		if (timescaleLerpProgress < timescaleLerpDuration) {
			timescaleLerpProgress += k.dt();
			const t = Math.min(timescaleLerpProgress / timescaleLerpDuration, 1);
			timeScale = startTimeScale + (targetTimeScale - startTimeScale) * t;
			audioService.updateAudioSpeed(timeScale);
		}

		if (gameState == GameState.Playing && !isPaused) {
			timeSeconds += dt();
			updateGameLoop();
		} else if (gameState == GameState.MainMenu) {
			updateMainMenuLoop();
		} else if (gameState == GameState.LevelEditor) {
			updateLevelEditor();
		}

		gridRegistry.updateVisibleCells();
	});

	// Pause toggle with Escape key
	k.onKeyPress("escape", () => {
		if (gameState !== GameState.Playing) return;
		togglePause();
	});

	// Slow motion controls
	k.onKeyPress("q", () => {
		setTimescale(0.5);
		audioService.playSound("slowdown", { volume: 1 });
		spawnRing({
			speed: 400,
			intensity: 0.2,
			maxRadius: Math.max(k.width(), k.height()),
			visualize: true,
			pos: k.center(),
		});
	});

	k.onKeyPress("e", () => {
		setTimescale(1);
	});

	// Temporary: Spawn timescale zone at mouse position (for testing)
	k.onKeyPress("q", () => {
		if (gameState !== GameState.Playing) return;
		const mousePos = k.mousePos();
		spawnTimescaleZone({
			pos: mousePos,
			radius: 100,
			timescaleValue: 0.3,
			duration: 5,
		});
	});

	// Temporary: Test chest opening sequence with K key
	k.onKeyPress("k", () => {
		if (gameState !== GameState.Playing) return;
		changeGameState(GameState.ChestOpening);
	});

	// Hex grid testing - generate random cave
	k.onKeyPress("h", () => {
		// Generate random cave with random seed
		const seed = Math.floor(Math.random() * 1000000);
		console.log(`Generating cave with seed: ${seed}`);

		const generatedMap = generateCave(seed, 30, 20);
		const hexGrid = generationMapToHexGrid(
			generatedMap,
			40, // hexSize
			k.width() / 2 - 600, // offsetX
			k.height() / 2 - 400 // offsetY
		);

		gridRegistry.register("caveGrid", hexGrid);
	});
});

export function changeGameState(state: number) {
	gameState = state;

	if (gameState == GameState.Playing) {
		startGame();
	} else if (gameState == GameState.MainMenu) {
		enterMainMenu();
	} else if (gameState == GameState.LevelEditor) {
		enterLevelEditor();
	} else if (gameState == GameState.ChestOpening) {
		startChestOpeningSequence(() => {
			changeGameState(GameState.Playing);
		});
	}
}

export function addScore(am: number) {
	score += am;
}

function loadGameSlot() {
	var slot = loadGame("slot1");
	if (!slot) return;

	setLoadout(slot.loadout);
	score = slot.score;
	timeSeconds = slot.time;
	loadPlayer();
}

function addBorderOffsets() {
	const center = k.center();
	outsideBorderPos.push(k.vec2(-borderOffset, -borderOffset));
	outsideBorderPos.push(k.vec2(center.x * 2 + borderOffset, -borderOffset));
	outsideBorderPos.push(
		k.vec2(center.x * 2 + borderOffset, center.y * 2 + borderOffset)
	);
	outsideBorderPos.push(k.vec2(-borderOffset, center.y * 2 + borderOffset));
}

export function getPosAtBorder(t: number) {
	const index = Math.floor(outsideBorderPos.length * t);
	const subtractT = (1 / outsideBorderPos.length) * index;
	const deltaT = (t - subtractT) * outsideBorderPos.length;
	const newPos = (
		index + 1 >= outsideBorderPos.length
			? outsideBorderPos[0]
			: outsideBorderPos[index + 1]
	).sub(outsideBorderPos[index]);

	const clampedIndex = k.clamp(index, 0, outsideBorderPos.length - 1);

	return outsideBorderPos[clampedIndex].add(newPos.scale(deltaT));
}

function togglePause() {
	isPaused = !isPaused;

	if (isPaused) {
		// Show pause text
		const objs = k.get<GameObj>(tags.gameLoop);

		objs.forEach((o) => {
			if (!o.paused) {
				o.paused = true;
			}
		});

		audioService.pauseMusic();
		loopService.pauseAll();
	} else {
		const objs = k.get<GameObj>(tags.gameLoop);

		objs.forEach((o) => {
			if (o.paused) {
				o.paused = false;
			}
		});
		audioService.resumeMusic();
		loopService.resumeAll();
	}
}
