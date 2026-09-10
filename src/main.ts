import kaplay, { GameObj, Vec2 } from "kaplay";
import { deleteGameSave, init, loadGame, saveGame } from "./util";
import {
	clearGame,
	exitRunToHub,
	playerDeathSequenceActive,
	startGame,
	updateGameLoop,
} from "./game";
import { enterMainMenu, updateMainMenuLoop } from "./ui/mainMenu";
import {
	clearAllUpgrades,
	addLvl,
	getEffectiveUpgradeLevel,
	getPermanentUpgradeLevel,
	getNextRunUpgradeLevel,
	grantRunUpgrade,
	isToolKey,
	setLoadout,
	setLoadoutRarity,
} from "./upg";
import {
	getPlayerMaxHealth,
	getRerollTokens,
	grantRerollTokens,
	loadPlayer,
	player,
	resetSession,
	session,
} from "./player";
import { initParticles, initUiEffects } from "./particles";
import { audioService } from "./services/audio/audioService";
import { loopService } from "./services/core/loopService";
import { upgradeService } from "./services/progression/upgradeService";
import { spawnRing } from "./spawn/spawnRing";
import { startChestOpeningSequence } from "./ui/chestOpening";
import { generateCave } from "./generation/caveGenerator";
import { generationMapToHexGrid } from "./generation/gridConversion";
import { runHexGridTests } from "./grid/hexGrid.test";
import { tags } from "./tags";
import { enterLevelEditor, updateLevelEditor } from "./levelEditor/levelEditor";
import { setupStatsWindow } from "./ui/statsWindow";
import {
	hideTacticalMap,
	showTacticalMap,
	tacticalMapOpen,
	toggleTacticalMap,
} from "./ui/tacticalMap";
import {
	debugIsVisible,
	initDebug,
	setDebugVisible,
	toggleDebug,
	updateDebug,
} from "./levelEditor/debug";
import { gridRegistry } from "./grid/gridRegistry";
import { hidePauseMenu, showPauseMenu } from "./ui/pauseMenu";
import {
	commandConsoleOpen,
	hideCommandConsole,
	moveCommandHistory,
	scrollCommandConsole,
	scrollCommandConsoleToEnd,
	scrollCommandConsoleToStart,
	showCommandConsole,
	submitCommand,
	toggleCommandConsole,
} from "./ui/commandConsole";
import { commandService } from "./services/debug/commandService";
import { discoverAllFloorRooms } from "./services/world/roomFloorService";
import { downloadCompleteGameDump } from "./services/debug/catalogDumpService";
import { playerObj } from "./game";
import { recoverPlayerHealth } from "./services/player/playerHealthService";
import { RUN_HULL_REINFORCEMENT_AMOUNT } from "./services/player/playerHealthBalance";
import { activeLevelKey, transitionToLevel } from "./levels/levels";
import {
	clearSelectedContract,
} from "./services/progression/contractService";
import {
	recordPlaytime,
	recordRunSalvage,
	resetRunStats,
} from "./services/runs/runStatsService";
import {
	getGeneratedRunSummary,
	revealEntireGeneratedRunMap,
	setNextGeneratedRunSeed,
	teleportPlayerToNearestDebreeDeposit,
	teleportPlayerToGeneratedRunExit,
} from "./levels/runMap";
import {
	canReceiveReward,
	applyReward,
	getRewardLockReason,
	createReward,
	getAllRewardDefinitions,
	getRewardDefinition,
	createDirectUpgradeReward,
	RewardRarity,
	RewardSource,
	type RewardKind,
} from "./services/economy/rewardService";
import {
	hideRecoveryShop,
	recoveryShopOpen,
	showRecoveryShop,
} from "./ui/recoveryShop";
import {
	hideHubFacilityPanel,
	hubFacilityPanelOpen,
} from "./ui/hubFacilities";
import {
	beginRunSession,
	runSessionActive,
} from "./services/runs/runDirectorService";
import {
	beginExtraLifeRun,
	getExtraLifeSnapshot,
} from "./services/progression/extraLifeService";
import { applyDamage } from "./services/combat/damageService";
import { spawnHealthOrb } from "./spawn/spawnHealthOrb";
import {
	isPlayerDebugInvulnerable,
	setPlayerDebugInvulnerable,
} from "./services/player/playerDamageState";
import {
	getThreatRomanNumeral,
	getThreatSnapshot,
	setThreatTier,
} from "./services/enemies/threatService";
import { spawnThreatEncounter } from "./services/enemies/enemyEncounterService";
import {
	formatPlaytestBuildList,
	getPlaytestBuild,
} from "./services/player/buildService";
import type { PlaytestBuild } from "./services/player/buildPresets";
import {
	addCollectedPowerup,
	clearGameLoopUi,
	setupGameLoopUi,
	updatePlayerHealthBar,
} from "./ui/gameUi";
import {
	clearRecoveryOffers,
	clearRunInventory,
} from "./services/runs/runInventoryService";
import { resetPowerupRuntime } from "./powerups";
import {
	getDebugEnemyTypes,
	isDebugEnemyType,
	spawnAllDebugEnemies,
	spawnDebugEnemies,
} from "./services/debug/debugEnemySpawnService";
import {
	beginProfilerFrame,
	frameProfilerEnabled,
	profileSection,
	resetFrameProfiler,
	setFrameProfilerEnabled,
} from "./services/debug/frameProfilerService";
import {
	clearDebreeStressTest,
	clearEnemyStressTest,
	clearProjectileStressTest,
	clearRocketStressTest,
	countStressDebree,
	countStressEnemies,
	countStressProjectiles,
	countStressRockets,
	spawnDebreeStressTest,
	spawnEnemyStressTest,
	spawnProjectileStressTest,
	spawnRocketStressTest,
} from "./services/debug/performanceStressService";
import {
	cancelPerformanceBenchmark,
	formatPerformanceBenchmarkReport,
	getPerformanceBenchmarkStatus,
	startPerformanceBenchmark,
	updatePerformanceBenchmark,
} from "./services/debug/performanceBenchmarkService";
import {
	runLoop,
	RunFrameContext,
} from "./services/runs/runLoopService";
import {
	beginDrawCallProfilerFrame,
	drawCallTraceRunning,
	formatDrawCallTraceReport,
	installDrawCallProfiler,
	startDrawCallTrace,
} from "./services/debug/drawCallProfilerService";
import { updateProjectileBatch } from "./services/combat/projectileService";
import { updateBatchedEntities } from "./services/core/entityUpdateService";
import {
	rebuildRuntimeSpatialIndex,
	updateRuntimeSpatialIndex,
} from "./services/core/runtimeSpatialIndexService";
import { updateRuntimeVisibility } from "./services/core/runtimeVisibilityService";
import { updateEnemySeparation } from "./services/enemies/enemySeparationService";
import { updateBatchedUi } from "./services/ui/uiUpdateService";
import { updateUiPointerRegions } from "./services/input/uiPointerService";
import {
	dialogBlocksGameplay,
	dialogCapturesInput,
} from "./services/narrative/dialogService";
import { cutsceneBlocksGameplay } from "./services/narrative/cutsceneService";
import {
	createLoadingScreen,
	trackInitialAssets,
} from "./ui/loadingScreen";
import {
	resetNarrativeProgress,
	shouldStartPrologue,
} from "./services/narrative/narrativeService";
import { formatPrologueTrace } from "./services/narrative/prologueTraceService";
import {
	getAvailableNpcDialogues,
	startNpcDialogue,
} from "./services/narrative/npcDialogueService";
import {
	runtimeDebug,
	type RuntimeDebugCategory,
} from "./services/debug/runtimeDebugService";
import {
	getHubChestLuck,
	getHubLevel,
	getHubLifetimeDeposited,
	recordHubDeposit,
	resetHubProgress,
	restockHubGhostChests,
	setHubLevelForDebug,
	unlockAllHubContentForDebug,
} from "./services/hub/hubProgressService";
import {
	resetWarpZoneProgress,
	unlockWarpZone,
	WARP_ZONES,
} from "./services/world/warpZoneService";
import {
	resetWeaponInventory,
	unlockWeapon,
	WEAPONS,
} from "./services/player/weaponService";
import {
	resetAbilityLoadout,
} from "./services/abilities/abilityLoadoutService";
import {
	resetActiveModule,
} from "./services/abilities/activeModuleService";
import { equipAbilityWithWorldDrop } from "./services/abilities/abilitySwapService";
import {
	ABILITIES,
	getAbilityDiscoveryKey,
} from "./services/abilities/abilityRegistry";
import { getAllUpgradeDefinitions } from "./upgrades/upgradeRegistry";
import { spawnRewardPickup } from "./spawn/spawnPowerup";
import { spawnDebreeValues } from "./spawn/spawnDebree";
import { splitSalvageValue } from "./services/economy/salvagePickupService";
import {
	addAvailableDebree,
	clearAvailableDebree,
	DEFAULT_DEPOSITED_DEBREE,
	getAvailableDebree,
	loadDepositedDebree,
	resetDebreeEconomy,
	spendAvailableDebree,
} from "./services/economy/debreeEconomyService";
import {
	clearPendingHubLevelReveal,
	clearPendingRunEndSummary,
} from "./services/runs/runCompletionService";
import {
	debreeDepositPanelOpen,
} from "./ui/debreeDepositPanel";
import {
	clearRunTelemetry,
	downloadRunTelemetry,
	formatLatestRunTelemetry,
	formatRewardTelemetrySummary,
	formatRunTelemetrySummary,
	formatSimulationTelemetrySummary,
	recordTelemetryEnemyKill,
	recordTelemetryEnemySpawn,
	recordTelemetrySalvageSpent,
	sampleRunTelemetry,
} from "./services/runs/runTelemetryService";
import {
	formatSyntheticRewardDiversity,
	simulateSyntheticRuns,
} from "./services/runs/runSimulationService";
import { installDisplaySettings } from "./services/ui/displaySettingsService";
import {
	cinematicModeIsEnabled,
	installCinematicModeService,
	setCinematicModeEnabled,
} from "./services/narrative/cinematicModeService";
import {
	installInputBindingService,
	onInputActionPress,
} from "./services/input/inputBindingService";

export const layers = {
	bg: "bg",
	buildings: "buildings",
	game2: "game2",
	game: "game",
	gameEffects: "gameEffects",
	gameText: "gameText",
	ui: "ui",
	uiEffects: "uiEffects",
	debug: "debug",
};

export const GameState = {
	MainMenu: 0,
	Playing: 1,
	LevelEditor: 2,
	ChestOpening: 3,
};

const borderOffset = -22;
export const BULLET_SPEED = 352;
export const ROCKET_SPEED = 280;
export let timeSeconds = 0;
export const outsideBorderPos: Vec2[] = [];

export const subSoundVolume = 0.3;
export const mainSoundVolume = 0.5;
export const musicVolume = 0.54;

// Keep world zoom and UI zoom independent. KAPLAY's global scale controls all
// fixed UI, while the camera compensates so changing UI_ZOOM does not alter
// how much of the game world is visible.
export const GAME_ZOOM = 1.8;
export const UI_ZOOM = 1;
export const WORLD_CAMERA_SCALE = GAME_ZOOM / UI_ZOOM;

let gameState = GameState.Playing;
let isPaused = false;
export let timeScale = 1;
let targetTimeScale = 1;
let startTimeScale = 1;
let timescaleLerpDuration = 0.3; // seconds
let timescaleLerpProgress = 0;
let audioFollowsTimescale = true;
let runLoopFrame = 0;
const loadingScreen = createLoadingScreen();

export const k = kaplay({
	background: "#000000",
	global: false,
	loadingScreen: false,
	scale: UI_ZOOM,
	// The game is authored as pixel art. Rendering at device DPR 2 quadruples
	// fragment work without adding useful sprite detail.
	pixelDensity: 1,
	crisp: true,
	texFilter: "nearest",
});

const preventBrowserDefault = (event: Event) => {
	event.preventDefault();
};

const preventSecondaryMouseDefault = (event: MouseEvent) => {
	if (event.button === 1 || event.button === 2) event.preventDefault();
};

document.addEventListener("contextmenu", preventBrowserDefault, {
	capture: true,
});
document.addEventListener("mousedown", preventSecondaryMouseDefault, {
	capture: true,
});
document.addEventListener("mouseup", preventSecondaryMouseDefault, {
	capture: true,
});
document.addEventListener("auxclick", preventSecondaryMouseDefault, {
	capture: true,
});
k.canvas.addEventListener("dragstart", preventBrowserDefault);

installDisplaySettings(k);
installInputBindingService(k);
installCinematicModeService(k);

installDrawCallProfiler(k.canvas);

export function dt() {
	return k.dt() * timeScale;
}
export function dtScaled() {
	return dt() * 100;
}

// Kaplay's move() already applies k.dt(), so velocities passed to it only need
// the game timescale. Authored movement values are already pixels per second.
export function velocityScale() {
	return timeScale;
}

/**
 * Set the target timescale with smooth lerping
 * @param target - The target timescale value
 * @param duration - Duration of the lerp in seconds (default: 0.3)
 */
export function setTimescale(
	target: number,
	duration: number = 0.3,
	affectAudio = true
) {
	startTimeScale = timeScale;
	targetTimeScale = target;
	timescaleLerpDuration = duration;
	timescaleLerpProgress = 0;
	audioFollowsTimescale = affectAudio;
	if (!affectAudio) audioService.updateAudioSpeed(1);
}

export function audioPlaybackSpeed() {
	return audioFollowsTimescale ? timeScale : 1;
}

init(trackInitialAssets(k, loadingScreen)).then(() => {
	audioService.syncSettings();
	initParticles();
	initUiEffects();
	upgradeService.initialize();
	loadGameSlot();
	setupStatsWindow();
	k.setLayers(
		[
			layers.bg,
			layers.buildings,
			layers.game2,
			layers.game,
			layers.gameEffects,
			layers.gameText,
			layers.ui,
			layers.uiEffects,
			layers.debug,
		],
		layers.game
	);
	initDebug();

	addBorderOffsets();
	registerDebugCommands();
	registerRunLoopSystems();
	k.onAdd(tags.enemy, (enemy) => {
		const spawnedAt = performance.now();
		const enemyType = typeof enemy.enemyType === "string"
			? enemy.enemyType
			: typeof enemy.sprite === "string"
				? enemy.sprite
				: "enemy";
		const elite = enemy.tags.includes(tags.elite);
		recordTelemetryEnemySpawn(enemyType, elite);
		if (typeof enemy.onDeath === "function") {
			enemy.onDeath(() => recordTelemetryEnemyKill(
				enemyType,
				elite,
				Math.max(0, (performance.now() - spawnedAt) / 1000)
			));
		}
	});

	changeGameState(GameState.MainMenu);
	loadingScreen.finish();

	k.onUpdate(() => {
		beginDrawCallProfilerFrame();
		const frameMs = k.dt() * 1000;
		beginProfilerFrame(frameMs);
		sampleRunTelemetry(k.dt(), getThreatSnapshot());
		profileSection("rootUpdate", () => {
			const context = createRunFrameContext();
			if (runLoop.isEnabled()) {
				profileSection("centralRunLoop", () => runLoop.update(context));
			} else {
				profileSection("legacyFrame", () => updateLegacyFrame(context));
			}
			profileSection("benchmarkUpdate", () => updatePerformanceBenchmark(
				frameMs,
				k.debug.drawCalls(),
				!commandConsoleOpen()
			));
		});
	});

	// Pause toggle with Escape key
	onInputActionPress("pause", () => {
		if (k.get(tags.confirmationDialog).length > 0) return;
		if (debreeDepositPanelOpen()) return;
		if (dialogCapturesInput()) return;
		if (tacticalMapOpen()) {
			hideTacticalMap();
			return;
		}
		if (hubFacilityPanelOpen()) {
			hideHubFacilityPanel();
			return;
		}
		if (recoveryShopOpen()) {
			hideRecoveryShop();
			return;
		}
		if (commandConsoleOpen()) {
			hideCommandConsole();
			return;
		}
		if (gameState !== GameState.Playing) return;
		if (playerDeathSequenceActive()) return;
		togglePause();
	});

	onInputActionPress("tacticalMap", () => {
		if (debreeDepositPanelOpen()) return;
		if (dialogCapturesInput()) return;
		if (commandService.isCapturingInput()) return;
		if (gameState !== GameState.Playing) return;
		if (playerDeathSequenceActive()) return;
		if (
			isPaused ||
			recoveryShopOpen() ||
			hubFacilityPanelOpen()
		) return;
		toggleTacticalMap();
	});

	for (const consoleKey of ["§", "`", "0"]) {
		k.onKeyPress(consoleKey, () => {
			if (consoleKey === "0" && commandConsoleOpen()) return;
			if (debreeDepositPanelOpen()) return;
			if (dialogCapturesInput()) return;
			if (tacticalMapOpen()) return;
			if (hubFacilityPanelOpen()) return;
			if (recoveryShopOpen()) return;
			if (playerDeathSequenceActive()) return;
			if (gameState !== GameState.Playing && !commandConsoleOpen()) return;
			toggleCommandConsole();
		});
	}

	k.onKeyPress("enter", () => {
		if (!commandConsoleOpen()) return;
		submitCommand();
	});

	onInputActionPress("interact", () => {
		if (hubFacilityPanelOpen()) {
			hideHubFacilityPanel();
			return;
		}
		if (recoveryShopOpen()) hideRecoveryShop();
	});

	k.onKeyPress("up", () => {
		if (!commandConsoleOpen()) return;
		moveCommandHistory(-1);
	});

	k.onKeyPress("down", () => {
		if (!commandConsoleOpen()) return;
		moveCommandHistory(1);
	});

	k.onKeyPress("pageup", () => {
		if (!commandConsoleOpen()) return;
		scrollCommandConsole(-280);
	});

	k.onKeyPress("pagedown", () => {
		if (!commandConsoleOpen()) return;
		scrollCommandConsole(280);
	});

	k.onKeyPress("home", () => {
		if (!commandConsoleOpen()) return;
		scrollCommandConsoleToStart();
	});

	k.onKeyPress("end", () => {
		if (!commandConsoleOpen()) return;
		scrollCommandConsoleToEnd();
	});

	// Temporary: Test chest opening sequence with K key
	k.onKeyPress("k", () => {
		if (commandConsoleOpen()) return;
		if (gameState !== GameState.Playing) return;
		changeGameState(GameState.ChestOpening);
	});

	// Hex grid testing - generate random cave
	k.onKeyPress("h", () => {
		if (commandConsoleOpen()) return;
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

function registerRunLoopSystems() {
	runLoop.clear();
	runLoop.register({
		id: "runtime:ui-pointer",
		phase: "input",
		update: updateUiPointerRegions,
	});
	runLoop.register({
		id: "core:timescale",
		phase: "timers",
		update: updateTimescale,
	});
	runLoop.register({
		id: "runtime:projectiles",
		phase: "movement",
		priority: -100,
		update: updateProjectileBatch,
	});
	runLoop.register({
		id: "runtime:spatial-index",
		phase: "spatialIndex",
		update: updateRuntimeSpatialIndex,
	});
	runLoop.register({
		id: "runtime:entities",
		phase: "collision",
		update: updateBatchedEntities,
	});
	runLoop.register({
		id: "runtime:enemy-separation",
		phase: "collision",
		priority: 100,
		update: updateEnemySeparation,
	});
	runLoop.register({
		id: "core:game-state",
		phase: "gameplay",
		update: updateActiveGameState,
	});
	runLoop.register({
		id: "runtime:ui",
		phase: "ui",
		priority: -100,
		update: updateBatchedUi,
	});
	runLoop.register({
		id: "core:debug-ui",
		phase: "ui",
		update: updateDebug,
	});
	runLoop.register({
		id: "core:grid-visibility",
		phase: "cleanup",
		update: () => profileSection(
			"gridVisibility",
			() => gridRegistry.updateVisibleCells()
		),
	});
	runLoop.register({
		id: "runtime:visibility",
		phase: "cleanup",
		priority: 100,
		update: updateRuntimeVisibility,
	});
}

function createRunFrameContext(): RunFrameContext {
	const rawDt = k.dt();
	const gameplayActive = canUpdateGameplay();
	return {
		frame: ++runLoopFrame,
		rawDt,
		dt: rawDt * timeScale,
		scaledDt: rawDt * timeScale * 100,
		timeScale,
		gameState,
		gameplayActive,
		paused: isPaused,
		cameraPos: k.camPos().clone(),
		cameraScale: k.camScale().clone(),
		viewportWidth: k.width(),
		viewportHeight: k.height(),
	};
}

function updateTimescale(context: RunFrameContext) {
	if (timescaleLerpProgress < timescaleLerpDuration) {
		timescaleLerpProgress += context.rawDt;
		const t = Math.min(timescaleLerpProgress / timescaleLerpDuration, 1);
		timeScale = startTimeScale + (targetTimeScale - startTimeScale) * t;
		if (t === 1 && targetTimeScale === 1) audioFollowsTimescale = true;
		audioService.updateAudioSpeed(audioPlaybackSpeed());
	}
	context.timeScale = timeScale;
	context.dt = context.rawDt * timeScale;
	context.scaledDt = context.dt * 100;
}

function canUpdateGameplay() {
	return gameState == GameState.Playing &&
		!isPaused &&
		!cutsceneBlocksGameplay() &&
		!dialogBlocksGameplay() &&
		!commandConsoleOpen() &&
		!recoveryShopOpen() &&
		!hubFacilityPanelOpen() &&
		!tacticalMapOpen();
}

function updateActiveGameState(context: RunFrameContext) {
	context.gameState = gameState;
	context.paused = isPaused;
	context.gameplayActive = canUpdateGameplay();
	if (context.gameplayActive) {
		timeSeconds += context.dt;
		recordPlaytime(context.rawDt);
		profileSection("gameLoop", updateGameLoop);
	} else if (gameState == GameState.MainMenu) {
		updateMainMenuLoop();
	} else if (gameState == GameState.LevelEditor) {
		updateLevelEditor();
	}
}

function updateLegacyFrame(context: RunFrameContext) {
	updateUiPointerRegions();
	updateTimescale(context);
	rebuildRuntimeSpatialIndex();
	updateActiveGameState(context);
	updateBatchedUi();
	profileSection("gridVisibility", () => gridRegistry.updateVisibleCells());
	updateRuntimeVisibility(context);
	updateDebug();
}

export function changeGameState(state: number) {
	const previousState = gameState;
	gameState = state;
	runtimeDebug.log("game", "game-state:changed", {
		from: gameStateName(previousState),
		to: gameStateName(state),
	});

	if (gameState == GameState.Playing) {
		if (previousState === GameState.ChestOpening) {
			setGameLoopPaused(false);
		} else {
			startGame();
		}
	} else if (gameState == GameState.MainMenu) {
		enterMainMenu();
	} else if (gameState == GameState.LevelEditor) {
		enterLevelEditor();
	} else if (gameState == GameState.ChestOpening) {
		setGameLoopPaused(true);
		startChestOpeningSequence(() => {
			changeGameState(GameState.Playing);
		});
	}
}

function gameStateName(state: number) {
	return Object.entries(GameState).find(([, value]) => value === state)?.[0]
		?? `Unknown(${state})`;
}

export function resetGameProfile() {
	deleteGameSave("slot1")
	resetDebreeEconomy()
	timeSeconds = 0
	clearAllUpgrades()
	resetSession()
	resetPowerupRuntime()
	clearRunInventory()
	clearRecoveryOffers()
	clearSelectedContract()
	resetWeaponInventory()
	resetActiveModule()
	resetAbilityLoadout()
	resetHubProgress()
	clearPendingRunEndSummary()
	clearPendingHubLevelReveal()
	clearRunTelemetry()
	resetWarpZoneProgress()
	resetRunStats()
	resetNarrativeProgress()
	loadPlayer()
}

function setGameLoopPaused(paused: boolean) {
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		obj.paused = paused;
	}
}

export function addScore(am: number) {
	const adjustedAmount = Math.max(0, Math.round(am));
	addAvailableDebree(adjustedAmount);
	recordRunSalvage(adjustedAmount);
	return adjustedAmount;
}

export function spendScore(amount: number) {
	const spent = spendAvailableDebree(amount);
	if (spent) recordTelemetrySalvageSpent(amount);
	return spent;
}

export function getScore() {
	return getAvailableDebree();
}

function registerDebugCommands() {
	commandService.register("help", "List available commands", () => {
		return commandService.list().join("\n");
	});

	commandService.register(
		"cinematic",
		"cinematic [on|off|toggle|status] - Hide HUD and pointer for recording",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "toggle";
			if (!["on", "off", "toggle", "status"].includes(mode)) {
				return "Usage: cinematic [on|off|toggle|status]";
			}
			if (mode === "status") {
				return `Cinematic mode ${cinematicModeIsEnabled() ? "enabled" : "disabled"}`;
			}

			const enabled = mode === "toggle"
				? !cinematicModeIsEnabled()
				: mode === "on";
			setCinematicModeEnabled(enabled);
			hideCommandConsole();
			return `Cinematic mode ${enabled ? "enabled" : "disabled"}`;
		}
	);

	commandService.register(
		"telemetry",
		"telemetry [last|rewards|diversity|simulations|export|clear] - Inspect or export run balance data",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "summary";
			if (mode === "last") return formatLatestRunTelemetry();
			if (mode === "rewards") return formatRewardTelemetrySummary();
			if (mode === "diversity") {
				const report = formatSyntheticRewardDiversity();
				k.canvas.dataset.telemetryReport = report;
				console.log(report);
				return report;
			}
			if (mode === "simulations") return formatSimulationTelemetrySummary();
			if (mode === "export") {
				return downloadRunTelemetry()
					? "Run telemetry exported as JSON"
					: "Telemetry export is unavailable";
			}
			if (mode === "clear") {
				clearRunTelemetry();
				return "Run telemetry cleared";
			}
			if (mode !== "summary") {
				return "Usage: telemetry [last|rewards|diversity|simulations|export|clear]";
			}
			return formatRunTelemetrySummary();
		}
	);

	commandService.register(
		"simulate",
		"simulate runs [count] [seed] [hub] [depth] | simulate chests [count] [seed] [hub]",
		(args) => {
			const profile = args[0]?.toLowerCase();
			const count = Number(args[1]);
			const seed = Number(args[2]);
			const hubLevel = Number(args[3]);
			const targetDepth = Number(args[4]);
			if (profile === "runs") {
				return simulateSyntheticRuns({
					runCount: Number.isFinite(count) ? count : 25,
					seed: Number.isFinite(seed) ? seed : Date.now(),
					hubLevel: Number.isFinite(hubLevel) ? hubLevel : undefined,
					targetDepth: Number.isFinite(targetDepth) ? targetDepth : 4,
					profile: "mixed",
				});
			}
			if (profile === "chests") {
				return simulateSyntheticRuns({
					runCount: 1,
					seed: Number.isFinite(seed) ? seed : Date.now(),
					hubLevel: Number.isFinite(hubLevel) ? hubLevel : undefined,
					levelUpsPerRun: 0,
					chestsPerRun: Number.isFinite(count) ? count : 100,
					profile: "chests",
				});
			}
			return "Usage: simulate runs [count] [seed] [hub] [depth] | simulate chests [count] [seed] [hub]";
		}
	);

	commandService.register(
		"intro",
		"intro reset - Replay the first-run prologue on the next start",
		(args) => {
			if (args[0]?.toLowerCase() !== "reset") return "Usage: intro reset";
			resetNarrativeProgress();
			return "Intro progress reset. Return to the menu and start again.";
		}
	);
	commandService.register(
		"prologuelog",
		"Print the latest prologue recovery trace",
		() => formatPrologueTrace()
	);
	commandService.register(
		"npc",
		"npc list | npc <id> - Start an active NPC conversation",
		(args) => {
			const available = getAvailableNpcDialogues();
			const id = args[0]?.toLowerCase();
			if (!id || id === "list") {
				return available.length > 0
					? `Available NPC dialogues: ${available.join(", ")}`
					: "No NPC dialogues are active in this scene";
			}
			if (!available.includes(id.replaceAll("_", "-"))) {
				return `NPC dialogue not available: ${id}. Use npc list.`;
			}
			hideCommandConsole();
			k.wait(0, () => startNpcDialogue(id));
			return `Starting NPC dialogue: ${id}`;
		}
	);
	commandService.register(
		"debuglog",
		"debuglog [on|off|clear|show] [category] - Runtime event logging",
		(args) => {
			const action = args[0]?.toLowerCase() ?? "status";
			if (action === "on") {
				runtimeDebug.clear();
				runtimeDebug.setEnabled(true);
				return "Runtime debug logging enabled; streaming to .debug/runtime.log";
			}
			if (action === "off") {
				runtimeDebug.setEnabled(false);
				return "Runtime debug logging disabled";
			}
			if (action === "clear") {
				runtimeDebug.clear();
				return "Runtime debug log cleared";
			}
			if (action === "show") {
				return runtimeDebug.format(args[1] as RuntimeDebugCategory | undefined);
			}
			return runtimeDebug.isEnabled()
				? "Runtime debug logging is enabled"
				: "Runtime debug logging is disabled";
		}
	);

	commandService.register("builds", "List curated playtest builds", () => {
		return formatPlaytestBuildList();
	});

	commandService.register(
		"upgrades",
		"upgrades clear - Remove all player upgrades and run reward effects",
		(args) => {
			if (args[0]?.toLowerCase() !== "clear") {
				return "Usage: upgrades clear";
			}
			if (!playerObj || !playerObj.exists()) return "No active player";

			const clearedUpgradeCount = clearAllUpgrades();
			resetSession();
			resetPowerupRuntime();
			clearRunInventory();
			clearRecoveryOffers();
			k.destroyAll(tags.follower);
			setTimescale(1, 0.2);
			loadPlayer();
			saveGame("slot1");

			playerObj.maxHP = getPlayerMaxHealth();
			playerObj.hp = Math.min(playerObj.hp, playerObj.maxHP);
			clearGameLoopUi();
			setupGameLoopUi(getPlayerMaxHealth(), false);
			updatePlayerHealthBar(playerObj.hp);

			return clearedUpgradeCount > 0
				? `Cleared ${clearedUpgradeCount} upgrade types and all run reward effects`
				: "Upgrades were already clear; run reward effects were reset";
		}
	);

	commandService.register(
		"build",
		"build <id> - Add a playtest build to the current upgrade arsenal",
		(args) => {
			if (!args[0]) return formatPlaytestBuildList();
			if (!playerObj || !playerObj.exists()) return "No active player";
			const build = getPlaytestBuild(args.join("-"));
			if (!build) return `Unknown build: ${args.join(" ")}. Type builds.`;
			const additions = addPlaytestBuildToArsenal(build);
			hideCommandConsole();
			return additions.length > 0
				? `Added ${build.name}: ${additions.join(", ")}`
				: `${build.name} is already in the arsenal`;
		}
	);

	commandService.register(
		"drawtrace",
		"drawtrace start [frames] | status | report | objects - Inspect WebGL batches",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "status";
			if (mode === "report") return formatDrawCallTraceReport();
			if (mode === "objects") {
				return ["sprite", "text", "circle", "rect", "particles"]
					.map((component) => `${component}: ${k.get(component, { recursive: true }).length}`)
					.join("\n");
			}
			if (mode === "status") {
				return drawCallTraceRunning()
					? "Draw trace running"
					: formatDrawCallTraceReport();
			}
			if (mode !== "start") {
				return "Usage: drawtrace start [frames] | status | report | objects";
			}
			const frames = Number(args[1] ?? 120);
			if (!Number.isInteger(frames) || frames < 1 || frames > 600) {
				return "Frame count must be an integer between 1 and 600";
			}
			startDrawCallTrace(frames);
			return `Draw trace started for ${frames} frames. Close the console, then use drawtrace report.`;
		}
	);

	commandService.register(
		"debug",
		"debug [on|off|toggle] - Show or hide the diagnostics HUD",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "toggle";
			if (!["on", "off", "toggle"].includes(mode)) {
				return "Usage: debug [on|off|toggle]";
			}

			if (mode === "toggle") toggleDebug();
			else setDebugVisible(mode === "on");
			if (debugIsVisible()) setFrameProfilerEnabled(true);
			return `Debug HUD ${debugIsVisible() ? "shown" : "hidden"}`;
		}
	);

	commandService.register(
		"profiler",
		"profiler [show|hide|on|off|status|reset|report] - Control performance diagnostics",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "show";
			if (mode === "reset") {
				resetFrameProfiler();
				return "Profiler samples reset";
			}
			if (mode === "report") {
				return formatPerformanceBenchmarkReport();
			}
			if (mode === "status") {
				return `Profiler ${frameProfilerEnabled() ? "enabled" : "disabled"}; HUD ${debugIsVisible() ? "shown" : "hidden"}`;
			}
			if (mode === "on" || mode === "show") setFrameProfilerEnabled(true);
			if (mode === "off") setFrameProfilerEnabled(false);
			if (mode === "show" || mode === "hide" || mode === "off") {
				setDebugVisible(mode === "show");
			}
			if (!["show", "hide", "on", "off"].includes(mode)) {
				return "Usage: profiler [show|hide|on|off|status|reset|report]";
			}
			return `Profiler ${frameProfilerEnabled() ? "enabled" : "disabled"}; HUD ${debugIsVisible() ? "shown" : "hidden"}`;
		}
	);

	commandService.register(
		"runloop",
		"runloop [status|on|off|systems|profile|unprofile] - Control the central scheduler",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "status";
			if (mode === "on" || mode === "off") {
				runLoop.setEnabled(mode === "on");
				return `Central run loop ${mode === "on" ? "enabled" : "disabled; using legacy frame path"}`;
			}
			if (mode === "profile" || mode === "unprofile") {
				runLoop.setSystemProfiling(mode === "profile");
				if (mode === "profile") setFrameProfilerEnabled(true);
				resetFrameProfiler();
				return `Per-system profiling ${mode === "profile" ? "enabled" : "disabled"}`;
			}
			if (mode === "systems") {
				const lines = ["ID | PHASE | PRIORITY", "---|---|---"];
				for (const system of runLoop.snapshot()) {
					lines.push(`${system.id} | ${system.phase} | ${system.priority}`);
				}
				return lines.join("\n");
			}
			if (mode !== "status") {
				return "Usage: runloop [status|on|off|systems|profile|unprofile]";
			}
			return `Central run loop ${runLoop.isEnabled() ? "ON" : "OFF"}; per-system profiling ${runLoop.isSystemProfilingEnabled() ? "ON" : "OFF"}; ${runLoop.snapshot().length} systems`;
		}
	);

	commandService.register(
		"benchmark",
		"benchmark start <name> [1-30s] | status | report | cancel",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "status";
			if (mode === "report") return formatPerformanceBenchmarkReport();
			if (mode === "cancel") {
				return cancelPerformanceBenchmark()
					? "Benchmark cancelled"
					: "No benchmark is running";
			}
			if (mode === "status") {
				const status = getPerformanceBenchmarkStatus();
				if (!status) return formatPerformanceBenchmarkReport();
				return `Benchmark ${status.name}: ${status.elapsed.toFixed(1)} / ${status.duration.toFixed(1)}s`;
			}
			if (mode !== "start") {
				return "Usage: benchmark start <name> [1-30s] | status | report | cancel";
			}
			const name = args[1]?.trim();
			const duration = Number(args[2] ?? 5);
			if (!name) return "Benchmark name is required";
			if (!Number.isFinite(duration) || duration < 1 || duration > 30) {
				return "Benchmark duration must be between 1 and 30 seconds";
			}
			startPerformanceBenchmark(name, duration);
			setDebugVisible(true);
			return `Benchmark ${name} started for ${duration}s. Close the console, then use benchmark report when it completes.`;
		}
	);

	commandService.register(
		"stress",
		"stress combat [enemies] [projectiles] [rockets] [debris] - Run deterministic load tests",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "projectiles";
			if (mode === "clear") {
				const rockets = clearRocketStressTest();
				const projectiles = clearProjectileStressTest();
				const enemies = clearEnemyStressTest();
				const debris = clearDebreeStressTest();
				return `Removed ${projectiles} projectiles, ${rockets} rockets, ${enemies} enemies, and ${debris} debris`;
			}
			if (mode === "status") {
				const rockets = countStressRockets();
				const projectiles = countStressProjectiles() - rockets;
				return `${projectiles} projectiles, ${rockets} rockets, ${countStressEnemies()} enemies, and ${countStressDebree()} debris active`;
			}
			if (![
				"projectiles",
				"rockets",
				"enemies",
				"debris",
				"combined",
				"combat",
			].includes(mode)) {
				return "Usage: stress combat [enemies] [projectiles] [rockets] [debris] | stress clear";
			}
			if (!playerObj || !playerObj.exists()) return "No active player";

			const firstCount = Number(args[1] ?? (mode === "projectiles" ? 1000 : 500));
			const projectileCount = Number(args[2] ?? firstCount);
			const rocketCount = Number(args[3] ?? Math.max(1, Math.round(firstCount / 5)));
			const debrisCount = Number(args[4] ?? firstCount);
			const counts = mode === "combat"
				? [firstCount, projectileCount, rocketCount, debrisCount]
				: mode === "combined"
					? [firstCount, projectileCount]
					: [firstCount];
			if (counts.some((count) =>
				!Number.isInteger(count) || count < 1 || count > 5000
			)) {
				return "Stress counts must be integers between 1 and 5000";
			}

			resetFrameProfiler();
			setDebugVisible(true);
			const paused = commandConsoleOpen();
			const origin = playerObj.pos.clone();
			const enemyResult = ["enemies", "combined", "combat"].includes(mode)
				? spawnEnemyStressTest(firstCount, origin, paused)
				: undefined;
			const projectileResult = ["projectiles", "combined", "combat"].includes(mode)
				? spawnProjectileStressTest(
					mode === "projectiles" ? firstCount : projectileCount,
					origin,
					paused
				)
				: undefined;
			const rocketResult = ["rockets", "combat"].includes(mode)
				? spawnRocketStressTest(
					mode === "rockets" ? firstCount : rocketCount,
					origin,
					paused
				)
				: undefined;
			const debrisResult = ["debris", "combat"].includes(mode)
				? spawnDebreeStressTest(
					mode === "debris" ? firstCount : debrisCount,
					origin,
					paused
				)
				: undefined;
			if (commandConsoleOpen()) {
				for (const obj of k.get<GameObj>(tags.gameLoop)) {
					obj.paused = true;
				}
			}
			const descriptions = [
				enemyResult ? `${enemyResult.spawned} enemies` : undefined,
				projectileResult
					? `${projectileResult.spawned} projectiles for ${projectileResult.lifetime}s`
					: undefined,
				rocketResult
					? `${rocketResult.spawned} rockets for ${rocketResult.lifetime}s`
					: undefined,
				debrisResult ? `${debrisResult.spawned} debris` : undefined,
			].filter(Boolean);
			const replaced = (enemyResult?.removed ?? 0) +
				(projectileResult?.removed ?? 0) +
				(rocketResult?.removed ?? 0) +
				(debrisResult?.removed ?? 0);
			const replacement = replaced > 0
				? ` Replaced ${replaced} prior stress objects.`
				: "";
			return `Spawned ${descriptions.join(" and ")}.${replacement}\nClose the console to begin; use stress clear to stop early.`;
		}
	);

	commandService.register("kill", "Kill the player", () => {
		hideCommandConsole();
		applyDamage(playerObj, playerObj.hp, {
			source: { name: "DEBUG COMMAND", sprite: "bullet1" },
		});
	});

	commandService.register("damage", "damage [amount]", (args) => {
		const amount = Number(args[0] ?? 1);
		if (!Number.isFinite(amount) || amount <= 0) return "Invalid damage amount";
		applyDamage(playerObj, amount, {
			source: { name: "DEBUG COMMAND", sprite: "bullet1" },
			playerHullDamage: true,
		});
		return `Dealt ${amount} damage`;
	});

	commandService.register("heal", "heal [amount]", (args) => {
		const amount = Number(args[0] ?? playerObj.maxHP);
		if (!Number.isFinite(amount) || amount <= 0) return "Invalid heal amount";
		const recovered = recoverPlayerHealth(playerObj, amount);
		return `Healed ${recovered}`;
	});

	commandService.register(
		"healthglobe",
		"Spawn a health globe near the player",
		() => {
			if (!playerObj || !playerObj.exists()) return "No active player";
			spawnHealthOrb(playerObj.pos.add(42, 0));
			hideCommandConsole();
			return "Spawned health globe";
		}
	);

	commandService.register(
		"debris",
		"debris [amount] - Spawn collectible debris near the player",
		(args) => {
			if (!playerObj || !playerObj.exists()) return "No active player";
			const amount = Number(args[0] ?? 10);
			if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
				return "Debris amount must be an integer from 1-1000";
			}
			spawnDebreeValues(playerObj.pos.add(42, 0), splitSalvageValue(amount), {
				pattern: "radial",
			});
			hideCommandConsole();
			return `Spawned ${amount} debris`;
		}
	);

	commandService.register(
		"invulnerable",
		"invulnerable [on|off|toggle] - Toggle player damage immunity",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "toggle";
			if (!["on", "off", "toggle"].includes(mode)) {
				return "Usage: invulnerable [on|off|toggle]";
			}
			const enabled = mode === "toggle"
				? !isPlayerDebugInvulnerable()
				: mode === "on";
			setPlayerDebugInvulnerable(enabled);
			return `Player invulnerability ${enabled ? "enabled" : "disabled"}`;
		}
	);

	commandService.register(
		"lives",
		"lives [0-3] - Inspect or set Phase Recall charges for this run",
		(args) => {
			if (args.length === 0) {
				const lives = getExtraLifeSnapshot();
				return `Phase Recall ${lives.remaining} / ${lives.capacity}`;
			}
			const charges = Number(args[0]);
			if (!Number.isInteger(charges) || charges < 0 || charges > 3) {
				return "Lives must be an integer from 0-3";
			}
			const lives = beginExtraLifeRun(charges);
			return `Phase Recall set to ${lives.remaining} / ${lives.capacity}`;
		}
	);

	commandService.register("hub", "Return to the hub", () => {
		hideCommandConsole();
		transitionToLevel("hub");
	});

	commandService.register("run", "Start a generated run", () => {
		const firstFloor = beginRunSession("zone1");
		if (!firstFloor) return "Zone 1 has no available levels";
		hideCommandConsole();
		transitionToLevel(firstFloor.levelKey);
	});

	commandService.register("recovery", "Open the recovery shop", () => {
		hideCommandConsole();
		showRecoveryShop();
	});

	commandService.register("training", "Open the Compendium", () => {
		hideCommandConsole();
		showTacticalMap("compendium");
	});

	commandService.register("map", "map [seed] - Preview a generated run", (args) => {
		const seed = args[0]
			? Number(args[0])
			: Math.floor(k.rand(1, 1000000));
		if (!Number.isSafeInteger(seed) || seed <= 0) {
			return "Seed must be a positive integer";
		}

		setNextGeneratedRunSeed(seed);
		const firstFloor = beginRunSession("zone1");
		if (!firstFloor) return "Zone 1 has no available levels";
		hideCommandConsole();
		transitionToLevel(firstFloor.levelKey);
		return `Loaded generated map ${seed}`;
	});

	commandService.register("mapinfo", "Show active generated room counts", () => {
		return getGeneratedRunSummary();
	});

	commandService.register("threat", "threat [1-5|auto] - Set threat level", (args) => {
		if (args.length === 0) {
			const threat = getThreatSnapshot();
			return `Threat ${getThreatRomanNumeral(threat.tier)} | Elite ${Math.round(threat.eliteChance * 100)}% | Enemies x${threat.spawnCountMultiplier.toFixed(2)} | HP x${threat.healthMultiplier.toFixed(2)} | DMG x${threat.damageMultiplier.toFixed(2)}`;
		}
		if (args[0].toLowerCase() === "auto") {
			setThreatTier(undefined);
			return "Threat returned to automatic progression";
		}
		const tier = Number(args[0]);
		if (!Number.isInteger(tier) || tier < 1 || tier > 5) {
			return "Threat must be 1-5 or auto";
		}
		setThreatTier(tier);
		return `Threat set to ${getThreatRomanNumeral(tier)}`;
	});

	commandService.register("encounter", "Spawn a threat-scaled encounter", () => {
		spawnThreatEncounter(playerObj.pos.add(220, 0), 48);
		return "Spawned threat encounter";
	});

	commandService.register(
		"spawn",
		"spawn <count> <type> [count type...] - Spawn chained enemy groups",
		(args) => {
			const availableTypes = getDebugEnemyTypes().join(", ");
			const tokens = args
				.flatMap((arg) => arg.split(/[,+;]/))
				.map((token) => token.trim().toLowerCase())
				.filter((token) => token && token !== "spawn");
			const usage = `Usage: spawn <count> <type> [count type...] | spawn all <count>. Types: ${availableTypes}`;
			if (
				tokens.length === 2 &&
				(tokens[0] === "all" || tokens[1] === "all")
			) {
				const count = Number(tokens[0] === "all" ? tokens[1] : tokens[0]);
				if (!Number.isInteger(count) || count < 1 || count > 1000) {
					return `All-enemy count must be an integer from 1-1000. ${usage}`;
				}
				if (!playerObj || !playerObj.exists()) return "No active player";
				const result = spawnAllDebugEnemies(count, playerObj.pos);
				return `Spawned ${result.spawned} enemy objects across ${result.types} types (${result.requested} requested)`;
			}
			if (tokens.length === 0 || tokens.length % 2 !== 0) return usage;

			const groups: Array<{
				count: number;
				type: Parameters<typeof spawnDebugEnemies>[1];
			}> = [];
			for (let index = 0; index < tokens.length; index += 2) {
				const count = Number(tokens[index]);
				const type = tokens[index + 1];
				if (!Number.isInteger(count) || count < 1 || count > 100) {
					return `Count must be an integer from 1-100 near "${tokens[index]}". ${usage}`;
				}
				if (!isDebugEnemyType(type)) {
					return `Unknown enemy type: ${type || "(missing)"}. Types: ${availableTypes}`;
				}
				groups.push({ count, type });
			}
			const totalCount = groups.reduce((total, group) => total + group.count, 0);
			if (totalCount > 100) {
				return `A chained spawn is limited to 100 enemies total; requested ${totalCount}`;
			}
			if (!playerObj || !playerObj.exists()) return "No active player";

			let indexOffset = 0;
			for (const group of groups) {
				spawnDebugEnemies(group.count, group.type, playerObj.pos, indexOffset);
				indexOffset += group.count;
			}
			return `Spawned ${groups.map(({ count, type }) => {
				const label = count === 1
					? type
					: type === "boss" || type === "mini-boss"
						? `${type}es`
						: `${type}s`;
				return `${count} ${label}`;
			}).join(", ")}`;
		}
	);

	commandService.register("exit", "Jump to the current run exit", () => {
		if (!teleportPlayerToGeneratedRunExit()) {
			return "No run exit is currently available";
		}
		hideCommandConsole();
		return "Jumped to the run exit";
	});

	commandService.register("relay", "Jump to the nearest salvage relay", () => {
		if (!teleportPlayerToNearestDebreeDeposit()) {
			return "No salvage relay is currently available";
		}
		hideCommandConsole();
		return "Jumped to the nearest salvage relay";
	});

	commandService.register(
		"revealmap",
		"Reveal the entire tactical map and discover all generated rooms",
		() => {
			const revealedCellCount = revealEntireGeneratedRunMap();
			const discoveredRoomCount = discoverAllFloorRooms();
			if (
				revealedCellCount === undefined &&
				discoveredRoomCount === undefined
			) return "No generated run is active";
			const changes = [
				revealedCellCount
					? `${revealedCellCount} map cells`
					: undefined,
				discoveredRoomCount
					? `${discoveredRoomCount} rooms`
					: undefined,
			].filter(Boolean);
			return changes.length > 0
				? `Revealed ${changes.join(" and ")}`
				: "The entire map is already revealed";
		}
	);

	commandService.register("timescale", "timescale [0.05-2]", (args) => {
		const value = Number(args[0]);
		if (!Number.isFinite(value) || value < 0.05 || value > 2) {
			return "Timescale must be between 0.05 and 2";
		}
		setTimescale(value);
		return `Timescale set to ${value}`;
	});

	commandService.register("score", "score [amount]", (args) => {
		const amount = Number(args[0]);
		if (!Number.isFinite(amount)) return "Invalid score amount";
		addScore(amount);
		return `Added ${amount} score`;
	});

	commandService.register(
		"salvage",
		"salvage clear - Clear the player's available salvage",
		(args) => {
			if (args[0]?.toLowerCase() !== "clear") {
				return "Usage: salvage clear";
			}
			const cleared = clearAvailableDebree();
			saveGame("slot1");
			return cleared > 0
				? `Cleared ${cleared} salvage`
				: "Player salvage is already clear";
		}
	);

	commandService.register("hublevel", "hublevel [1-8] - Show or set hub level", (args) => {
		if (args.length === 0) {
			return `Hub level ${getHubLevel()} | XP ${getHubLifetimeDeposited()} | Chest luck +${Math.round(getHubChestLuck() * 100)}%`;
		}
		const level = Number(args[0]);
		if (!Number.isInteger(level) || level < 1 || level > 8) {
			return "Hub level must be between 1 and 8";
		}
		setHubLevelForDebug(level);
		return `Hub level set to ${level}`;
	});

	commandService.register(
		"unlockall",
		"Unlock all progression, facilities, equipment, and discoveries",
		() => {
			if (getPermanentUpgradeLevel("salvageLasso") === undefined) {
				addLvl("salvageLasso");
			}
			const rewardBlueprintKeys = getAllRewardDefinitions()
				.filter((reward) =>
					reward.kind === "powerup" || reward.kind === "item"
				)
				.map((reward) => reward.powerupKey ?? reward.id);
			const blueprintKeys = [
				...ABILITIES.map(getAbilityDiscoveryKey),
				...getAllUpgradeDefinitions().map((upgrade) => upgrade.toolKey),
				...rewardBlueprintKeys,
			];
			const hub = unlockAllHubContentForDebug(blueprintKeys);
			for (const weapon of WEAPONS) unlockWeapon(weapon.id, false);
			for (const zone of WARP_ZONES) unlockWarpZone(zone.id);
			saveGame("slot1");
			return `Unlocked all content | Hub ${hub.hubLevel} | ${hub.facilities} facilities | ${WEAPONS.length} weapons | ${ABILITIES.length} abilities | ${blueprintKeys.length} discoveries | ${WARP_ZONES.length} zones`;
		}
	);

	commandService.register("hubxp", "hubxp <amount> - Add deposited hub XP", (args) => {
		const amount = Number(args[0]);
		if (!Number.isFinite(amount) || amount <= 0) return "Hub XP must be positive";
		const result = recordHubDeposit(amount);
		return `Added ${result.deposited} hub XP | Level ${result.currentLevel}`;
	});

	commandService.register("hubstock", "Restock unlocked hub ghost chests", () => {
		restockHubGhostChests();
		return "Hub ghost chest stock restored";
	});

	commandService.register(
		"rerolls",
		"rerolls [amount] - Show or grant reroll tokens",
		(args) => {
			if (args.length === 0) {
				return `${getRerollTokens()} reroll tokens available`;
			}
			const amount = Number(args[0]);
			if (!Number.isInteger(amount) || amount < 1 || amount > 99) {
				return "Amount must be an integer between 1 and 99";
			}
			const total = grantRerollTokens(amount);
			return `Granted ${amount} reroll tokens; ${total} available`;
		}
	);

	commandService.register(
		"dump",
		"Download and print the complete game data catalog",
		() => {
			const filename = downloadCompleteGameDump();
			return filename
				? `Complete game data printed and downloaded as ${filename}`
				: "Game data export is unavailable";
		}
	);

	commandService.register(
		"rewards",
		"rewards [source] [-t type] [-r rarity] - Filter reward stats and weights",
		(args) => {
			const filters = parseRewardFilters(args);
			if (filters.error) return filters.error;
			const rewards = getAllRewardDefinitions(filters.source).filter(
				(reward) =>
					(!filters.kind || reward.kind === filters.kind) &&
					(!filters.rarity || reward.rarity === filters.rarity)
			);
			if (rewards.length === 0) return "No rewards match these filters";
			const lines = [
				`## Rewards (${rewards.length})`,
				"| Icon | Reward | Type | Rarity | OK | Effect | C | E | B |",
				"| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |",
			];
			for (const reward of rewards) {
				const stats = Object.entries(reward.stats)
					.map(([key, value]) => `${key}:${value}`)
					.join(", ");
				const eligible = canReceiveReward(reward)
					? "ON"
					: getRewardLockReason(reward) ?? "OFF";
				const rewardId = reward.upgradeKey
					? `${reward.upgradeKey}:${(reward.levelIndex ?? 0) + 1}`
					: reward.id;
				lines.push(
					`| :sprite(${reward.sprite}): | ${rewardId} | ${reward.kind} | ${reward.rarity} | ${eligible} | ${stats} | ${reward.weights.crate ?? "-"} | ${reward.weights.enemy ?? "-"} | ${reward.weights.boss ?? "-"} |`
				);
			}
			return lines.join("\n");
		}
	);

	commandService.register(
		"reward",
		"reward <id> [rarity] | reward allweapons|allactivemodules|allmobility|allultimates|allpowerups|allitems|allupgrades",
		(args) => {
			const testCategory = getRewardTestCategory(args[0]);
			if (testCategory) {
				if (!playerObj || !playerObj.exists()) return "No active player";
				hideCommandConsole();
				return spawnRewardTestCategory(
					playerObj.pos.clone(),
					testCategory.kind,
					testCategory.label
				);
			}
			if (args[0]?.toLowerCase().startsWith("all")) {
				return "Categories: allweapons, allactivemodules, allmobility, allultimates, allpowerups, allitems, allupgrades";
			}
			const definition = getRewardDefinition(args[0] ?? "");
			const isAbility = definition?.abilityId !== undefined &&
				definition.abilitySlot !== undefined;
			if (definition && !isAbility && !canReceiveReward(definition)) {
				return getRewardLockReason(definition) ?? "Reward is locked";
			}
			const rarityName = args[1]?.toUpperCase();
			const rarity = rarityName
				? Object.values(RewardRarity).find((value) => value === rarityName)
				: undefined;
			if (rarityName && !rarity) {
				return "Rarity must be common, uncommon, rare, epic, or legendary";
			}
			const reward = definition
				? createReward(definition.id, rarity)
				: undefined;
			if (!reward) return "Unknown reward. Use rewards to list them.";
			if (!playerObj || !playerObj.exists()) return "No active player";
			hideCommandConsole();
			if (!applyReward(reward, playerObj.pos.clone())) {
				return `Could not apply ${reward.name}`;
			}
			const equipped = equipConsoleReward(reward, playerObj.pos.clone());
			addCollectedPowerup(reward);
			saveGame("slot1");
			return equipped
				? `Granted and equipped ${reward.name}`
				: `Granted and applied ${reward.name}`;
		}
	);
}

interface RewardFilters {
	source?: RewardSource;
	kind?: RewardKind;
	rarity?: RewardRarity;
	error?: string;
}

const REWARD_TYPE_FILTERS: Readonly<Record<string, RewardKind>> = {
	powerup: "powerup",
	powerups: "powerup",
	upgrade: "upgrade",
	upgrades: "upgrade",
	weapon: "weapon",
	weapons: "weapon",
	item: "item",
	items: "item",
	active: "activeModule",
	activemodule: "activeModule",
	activemodules: "activeModule",
	module: "activeModule",
	modules: "activeModule",
	mobility: "mobility",
	ultimate: "ultimate",
	ultimates: "ultimate",
};

function parseRewardFilters(args: string[]): RewardFilters {
	const filters: RewardFilters = {};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index].toLowerCase();
		if (arg === "-s" || arg === "--source") {
			const source = args[++index]?.toLowerCase();
			if (!source || !["crate", "enemy", "boss"].includes(source)) {
				return { error: "Source must be crate, enemy, or boss" };
			}
			filters.source = source as RewardSource;
			continue;
		}
		if (arg === "-t" || arg === "--type") {
			const type = args[++index]?.toLowerCase();
			const kind = type ? REWARD_TYPE_FILTERS[type] : undefined;
			if (!kind) {
				return {
					error: "Type must be powerup, upgrade, weapon, item, active, mobility, or ultimate",
				};
			}
			filters.kind = kind;
			continue;
		}
		if (arg === "-r" || arg === "--rarity") {
			const rarityName = args[++index]?.toUpperCase();
			const rarity = Object.values(RewardRarity).find(
				(value) => value === rarityName
			);
			if (!rarity) {
				return {
					error: "Rarity must be common, uncommon, rare, epic, or legendary",
				};
			}
			filters.rarity = rarity;
			continue;
		}
		if (["crate", "enemy", "boss"].includes(arg) && !filters.source) {
			filters.source = arg as RewardSource;
			continue;
		}
		return {
			error: "Usage: rewards [crate|enemy|boss] [-t type] [-r rarity]",
		};
	}
	return filters;
}

const REWARD_TEST_CATEGORIES: Readonly<
	Record<string, { kind: RewardKind; label: string }>
> = {
	allweapons: { kind: "weapon", label: "weapons" },
	allactivemodules: { kind: "activeModule", label: "active modules" },
	allactive: { kind: "activeModule", label: "active modules" },
	allmodules: { kind: "activeModule", label: "active modules" },
	allmobility: { kind: "mobility", label: "mobility abilities" },
	allultimates: { kind: "ultimate", label: "ultimate abilities" },
	allultimate: { kind: "ultimate", label: "ultimate abilities" },
	allpowerups: { kind: "powerup", label: "powerups" },
	allitems: { kind: "item", label: "items" },
	allupgrades: { kind: "upgrade", label: "upgrades" },
};

function getRewardTestCategory(input: string | undefined) {
	if (!input) return undefined;
	return REWARD_TEST_CATEGORIES[input.toLowerCase()];
}

function spawnRewardTestCategory(
	position: Vec2,
	kind: RewardKind,
	label: string
) {
	const definitions = getAllRewardDefinitions().filter(
		(definition) => definition.kind === kind
	);
	const pickupsPerRing = 10;
	const firstRadius = 170;
	const ringSpacing = 95;
	let spawned = 0;
	for (let index = 0; index < definitions.length; index++) {
		const definition = definitions[index];
		const reward = createReward(definition.id, RewardRarity.Common);
		if (!reward) continue;
		const ringIndex = Math.floor(index / pickupsPerRing);
		const indexInRing = index % pickupsPerRing;
		const itemsInRing = Math.min(
			pickupsPerRing,
			definitions.length - ringIndex * pickupsPerRing
		);
		const angle = -90 + indexInRing * (360 / itemsInRing);
		const radius = firstRadius + ringIndex * ringSpacing;
		spawnRewardPickup(
			position.add(k.Vec2.fromAngle(angle).scale(radius)),
			reward,
			{
				stationary: true,
				interactionOnly: true,
				suppressAcquisition: true,
				label: definition.name,
				applyEffect: (pickedReward, pickupPosition) => {
					if (!applyReward(pickedReward, pickupPosition)) return false;
					const isAbility = pickedReward.abilityId !== undefined &&
						pickedReward.abilitySlot !== undefined;
					if (
						isAbility &&
						!equipConsoleReward(pickedReward, pickupPosition)
					) return false;
					saveGame("slot1");
					return true;
				},
			}
		);
		spawned++;
	}
	return `Dropped ${spawned} ${label} around the player`;
}

function equipConsoleReward(
	reward: ReturnType<typeof createReward>,
	position: Vec2
) {
	if (!reward?.abilityId || !reward.abilitySlot) return false;
	return equipAbilityWithWorldDrop(
		reward.abilitySlot,
		reward.abilityId,
		position
	);
}

function addPlaytestBuildToArsenal(build: PlaytestBuild) {
	const additions: string[] = [];
	for (const [toolKey, level] of Object.entries(build.upgrades)) {
		if (level === undefined || !isToolKey(toolKey)) continue;
		while ((getEffectiveUpgradeLevel(toolKey) ?? -1) < level) {
			const nextLevel = getNextRunUpgradeLevel(toolKey);
			if (nextLevel === undefined) break;
			const reward = createDirectUpgradeReward(toolKey, nextLevel);
			if (!reward || grantRunUpgrade(toolKey) === undefined) break;
			loadPlayer();
			addCollectedPowerup(reward);
			additions.push(reward.name);
		}
	}

	addBuildPowerups(
		"addFollower",
		build.followers ?? 0,
		k.get(tags.follower).length,
		1,
		additions
	);
	addBuildPowerups(
		"addPlayerMaxHealth",
		(build.extraHealth ?? 0) * RUN_HULL_REINFORCEMENT_AMOUNT,
		session.extraHealth,
		RUN_HULL_REINFORCEMENT_AMOUNT,
		additions
	);
	addBuildPowerups(
		"addExtraRockets",
		build.extraRockets ?? 0,
		session.extraRockets,
		1,
		additions
	);
	addBuildPowerups(
		"addSpaceDebree",
		build.extraMissileShards ?? 0,
		session.extraSpaceDebreeInMissiles,
		2,
		additions
	);
	addBuildPowerups(
		"addPrimaryRocketChance",
		build.primaryRocketChance ?? 0,
		session.primaryRocketChance,
		0.1,
		additions
	);
	const armorLimit = player.salvageSetBonus ? 4 : 3;
	session.scrapArmorCharges = Math.max(
		session.scrapArmorCharges,
		Math.min(build.initialScrapArmor ?? 0, armorLimit)
	);
	return additions;
}

function addBuildPowerups(
	id: string,
	target: number,
	current: number,
	step: number,
	additions: string[]
) {
	const reward = createReward(id);
	if (!reward) return;
	const count = Math.max(0, Math.ceil((target - current) / step));
	for (let index = 0; index < count; index++) {
		if (!applyReward(reward, playerObj.pos.clone())) break;
		addCollectedPowerup(reward);
		additions.push(reward.name);
	}
}

function loadGameSlot() {
	var slot = loadGame("slot1");
	if (!slot) {
		if (!shouldStartPrologue()) saveGame("slot1")
		return;
	}

	setLoadout(slot.loadout);
	setLoadoutRarity(slot.loadoutRarity ?? {});
	loadDepositedDebree(slot.score ?? DEFAULT_DEPOSITED_DEBREE);
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

export function getPosAtBorder(t: number, center: Vec2 = k.getCamPos()) {
	const index = Math.floor(outsideBorderPos.length * t);
	const subtractT = (1 / outsideBorderPos.length) * index;
	const deltaT = (t - subtractT) * outsideBorderPos.length;
	const newPos = (
		index + 1 >= outsideBorderPos.length
			? outsideBorderPos[0]
			: outsideBorderPos[index + 1]
	).sub(outsideBorderPos[index]);

	const clampedIndex = k.clamp(index, 0, outsideBorderPos.length - 1);

	const cameraOffset = center.sub(k.center());
	return outsideBorderPos[clampedIndex]
		.add(newPos.scale(deltaT))
		.add(cameraOffset);
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
		showPauseMenu({
			onResume: togglePause,
			onExitRun:
				activeLevelKey() !== "hub" && runSessionActive()
					? exitPausedRun
					: undefined,
			onQuit: quitPausedGame,
		});
	} else {
		hidePauseMenu();
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

function exitPausedRun() {
	hidePauseMenu();
	isPaused = false;
	loopService.resumeAll();
	exitRunToHub();
}

function quitPausedGame() {
	hidePauseMenu();
	isPaused = false;
	destroyGameLoopObjects();
	clearGame();
}

function destroyGameLoopObjects() {
	const objects = k.get<GameObj>(tags.gameLoop).sort(
		(a, b) => gameObjectDepth(b) - gameObjectDepth(a)
	);
	for (const object of objects) {
		if (object.exists()) k.destroy(object);
	}
}

function gameObjectDepth(object: GameObj) {
	let depth = 0;
	let parent = object.parent;
	while (parent) {
		depth++;
		parent = parent.parent;
	}
	return depth;
}
