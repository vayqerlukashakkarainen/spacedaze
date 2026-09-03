import kaplay, { GameObj, Vec2 } from "kaplay";
import { init, loadGame, saveGame } from "./util";
import {
	clearGame,
	playerDeathSequenceActive,
	startGame,
	updateGameLoop,
} from "./game";
import { enterMainMenu, updateMainMenuLoop } from "./ui/mainMenu";
import {
	clearAllUpgrades,
	getEffectiveUpgradeLevel,
	getNextRunUpgradeLevel,
	grantRunUpgrade,
	isToolKey,
	setLoadout,
} from "./upg";
import { loadPlayer, player, resetSession, session } from "./player";
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
import {
	hideTacticalMap,
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
import { commandService } from "./services/commandService";
import { playerObj } from "./game";
import { transitionToLevel } from "./levels/levels";
import { getSelectedContract } from "./services/contractService";
import {
	recordPlaytime,
	recordRunSalvage,
	runStatsActive,
} from "./services/runStatsService";
import {
	getGeneratedRunSummary,
	revealEntireGeneratedRunMap,
	setNextGeneratedRunSeed,
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
	RewardSource,
} from "./services/rewardService";
import { spawnRewardPickup } from "./spawn/spawnPowerup";
import {
	hideRecoveryShop,
	recoveryShopOpen,
	showRecoveryShop,
} from "./ui/recoveryShop";
import {
	hideHubFacilityPanel,
	hubFacilityPanelOpen,
	showArsenal,
} from "./ui/hubFacilities";
import { beginRunSession } from "./services/runDirectorService";
import { applyDamage } from "./services/damageService";
import {
	getThreatRomanNumeral,
	getThreatSnapshot,
	setThreatTier,
} from "./services/threatService";
import { spawnThreatEncounter } from "./services/enemyEncounterService";
import {
	formatPlaytestBuildList,
	getPlaytestBuild,
} from "./services/buildService";
import type { PlaytestBuild } from "./services/buildPresets";
import {
	addCollectedPowerup,
	clearGameLoopUi,
	setupGameLoopUi,
	updatePlayerHealthBar,
} from "./ui/gameUi";
import {
	clearRecoveryOffers,
	clearRunInventory,
} from "./services/runInventoryService";
import { resetPowerupRuntime } from "./powerups";
import {
	getDebugEnemyTypes,
	isDebugEnemyType,
	spawnDebugEnemies,
} from "./services/debugEnemySpawnService";
import {
	profileSection,
	recordFrameTime,
	resetFrameProfiler,
} from "./services/frameProfilerService";

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

// Keep world zoom and UI zoom independent. KAPLAY's global scale controls all
// fixed UI, while the camera compensates so changing UI_ZOOM does not alter
// how much of the game world is visible.
export const GAME_ZOOM = 2;
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

export const k = kaplay({
	background: "#000000",
	global: false,
	scale: UI_ZOOM,
});

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

init(k).then(() => {
	audioService.syncSettings();
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
	registerDebugCommands();

	changeGameState(GameState.MainMenu);

	k.onUpdate(() => {
		recordFrameTime(k.dt() * 1000);
		// Update debug info
		updateDebug();

		// Lerp timescale towards target
		if (timescaleLerpProgress < timescaleLerpDuration) {
			timescaleLerpProgress += k.dt();
			const t = Math.min(timescaleLerpProgress / timescaleLerpDuration, 1);
			timeScale = startTimeScale + (targetTimeScale - startTimeScale) * t;
			if (t === 1 && targetTimeScale === 1) audioFollowsTimescale = true;
			audioService.updateAudioSpeed(audioPlaybackSpeed());
		}

		if (
			gameState == GameState.Playing &&
			!isPaused &&
			!commandConsoleOpen() &&
			!recoveryShopOpen() &&
			!hubFacilityPanelOpen() &&
			!tacticalMapOpen()
		) {
			timeSeconds += dt();
			recordPlaytime(k.dt());
			profileSection("gameLoop", updateGameLoop);
		} else if (gameState == GameState.MainMenu) {
			updateMainMenuLoop();
		} else if (gameState == GameState.LevelEditor) {
			updateLevelEditor();
		}

		profileSection("gridVisibility", () => gridRegistry.updateVisibleCells());
	});

	// Pause toggle with Escape key
	k.onKeyPress("escape", () => {
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

	k.onKeyPress("tab", () => {
		if (commandService.isCapturingInput()) return;
		if (gameState !== GameState.Playing) return;
		if (playerDeathSequenceActive()) return;
		if (isPaused || recoveryShopOpen() || hubFacilityPanelOpen()) return;
		toggleTacticalMap();
	});

	for (const consoleKey of ["§", "`"]) {
		k.onKeyPress(consoleKey, () => {
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

	// Slow motion controls
	k.onKeyPress("q", () => {
		if (commandConsoleOpen()) return;
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
		if (commandConsoleOpen()) return;
		setTimescale(1);
	});

	// Temporary: Spawn timescale zone at mouse position (for testing)
	k.onKeyPress("q", () => {
		if (commandConsoleOpen()) return;
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

export function changeGameState(state: number) {
	const previousState = gameState;
	gameState = state;

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

function setGameLoopPaused(paused: boolean) {
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		obj.paused = paused;
	}
}

export function addScore(am: number) {
	const multiplier = runStatsActive()
		? getSelectedContract()?.salvageMultiplier ?? 1
		: 1;
	const adjustedAmount = Math.max(0, Math.round(am * multiplier));
	score += adjustedAmount;
	recordRunSalvage(adjustedAmount);
	return adjustedAmount;
}

export function spendScore(amount: number) {
	if (!Number.isFinite(amount) || amount < 0 || score < amount) return false;
	score -= amount;
	return true;
}

export function getScore() {
	return score;
}

function registerDebugCommands() {
	commandService.register("help", "List available commands", () => {
		return commandService.list().join("\n");
	});

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

			playerObj.setMaxHP(player.maxHealth);
			clearGameLoopUi();
			setupGameLoopUi(player.maxHealth, false);
			updatePlayerHealthBar(playerObj.hp());

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
		"debug",
		"debug [on|off|toggle] - Show or hide the diagnostics HUD",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "toggle";
			if (!["on", "off", "toggle"].includes(mode)) {
				return "Usage: debug [on|off|toggle]";
			}

			if (mode === "toggle") toggleDebug();
			else setDebugVisible(mode === "on");
			return `Debug HUD ${debugIsVisible() ? "shown" : "hidden"}`;
		}
	);

	commandService.register(
		"profiler",
		"profiler [show|hide|reset] - Control performance diagnostics",
		(args) => {
			const mode = args[0]?.toLowerCase() ?? "show";
			if (mode === "reset") {
				resetFrameProfiler();
				return "Profiler samples reset";
			}
			if (mode !== "show" && mode !== "hide") {
				return "Usage: profiler [show|hide|reset]";
			}
			setDebugVisible(mode === "show");
			return `Profiler ${mode === "show" ? "shown" : "hidden"}`;
		}
	);

	commandService.register("kill", "Kill the player", () => {
		hideCommandConsole();
		applyDamage(playerObj, playerObj.hp());
	});

	commandService.register("damage", "damage [amount]", (args) => {
		const amount = Number(args[0] ?? 1);
		if (!Number.isFinite(amount) || amount <= 0) return "Invalid damage amount";
		applyDamage(playerObj, amount);
		return `Dealt ${amount} damage`;
	});

	commandService.register("heal", "heal [amount]", (args) => {
		const amount = Number(args[0] ?? playerObj.maxHP);
		if (!Number.isFinite(amount) || amount <= 0) return "Invalid heal amount";
		playerObj.heal(amount);
		return `Healed ${amount}`;
	});

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

	commandService.register("arsenal", "Open the arsenal", () => {
		hideCommandConsole();
		showArsenal();
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
		"spawn <count> <type> - Spawn enemies near the player",
		(args) => {
			const count = Number(args[0]);
			const type = args[1]?.toLowerCase() ?? "";
			const availableTypes = getDebugEnemyTypes().join(", ");
			if (!Number.isInteger(count) || count < 1 || count > 100) {
				return `Usage: spawn <count 1-100> <type>. Types: ${availableTypes}`;
			}
			if (!isDebugEnemyType(type)) {
				return `Unknown enemy type: ${type || "(missing)"}. Types: ${availableTypes}`;
			}
			if (!playerObj || !playerObj.exists()) return "No active player";

			spawnDebugEnemies(count, type, playerObj.pos);
			const label = count === 1
				? type
				: type === "boss"
					? "bosses"
					: `${type}s`;
			return `Spawned ${count} ${label}`;
		}
	);

	commandService.register("exit", "Jump to the current run exit", () => {
		if (!teleportPlayerToGeneratedRunExit()) {
			return "No run exit is currently available";
		}
		hideCommandConsole();
		return "Jumped to the run exit";
	});

	commandService.register(
		"revealmap",
		"Reveal the entire current tactical map",
		() => {
			const revealedCount = revealEntireGeneratedRunMap();
			if (revealedCount === undefined) return "No generated run is active";
			return revealedCount > 0
				? `Revealed ${revealedCount} map cells`
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
		"rewards",
		"rewards [crate|enemy|boss] - Print reward stats and weights",
		(args) => {
			const source = args[0] as RewardSource | undefined;
			if (source && !["crate", "enemy", "boss"].includes(source)) {
				return "Source must be crate, enemy, or boss";
			}
			const rewards = getAllRewardDefinitions(source);
			if (rewards.length === 0) return "No rewards for this source";
			const lines = [
				"## Rewards",
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

	commandService.register("reward", "reward <id> - Spawn a reward", (args) => {
		const definition = getRewardDefinition(args[0] ?? "");
		if (definition && !canReceiveReward(definition)) {
			return getRewardLockReason(definition) ?? "Reward is locked";
		}
		const reward = definition ? createReward(definition.id) : undefined;
		if (!reward) return "Unknown reward. Use rewards to list them.";
		hideCommandConsole();
		spawnRewardPickup(playerObj.pos.clone(), reward);
		return `Spawned ${reward.name}`;
	});
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
		build.extraHealth ?? 0,
		session.extraHealth,
		1,
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

function quitPausedGame() {
	hidePauseMenu();
	isPaused = false;
	k.destroyAll(tags.gameLoop);
	clearGame();
}
