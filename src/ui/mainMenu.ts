import { changeGameState, GameState, k } from "../main";
import { createUiButton } from "./common/button";
import { createUiLabel } from "./common/label";
import { tags } from "../tags";
import { createVolumeControls } from "./volumeControls";
import { compactUi, fitUiWidth } from "./common/layout";
import { createUiPanel } from "./common/panel";
import { UI_COLORS } from "./common/theme";
import { getLifetimeStats } from "../services/runStatsService";

export function enterMainMenu() {
	const center = k.center();
	const compact = compactUi();
	const buttonWidth = fitUiWidth(300, 30);
	const titleY = compact ? center.y - 165 : center.y - 100;
	const startY = compact ? center.y - 82 : center.y;
	const editorY = compact ? center.y - 22 : center.y + 70;
	const volumeY = compact ? center.y + 45 : center.y + 140;

	// Title
	createUiLabel({
		pos: k.vec2(center.x, titleY),
		txt: "SPACEDAZE",
		color: k.Color.fromHex("#ffffff"),
		fontSize: 32,
		tags: [tags.mainMenu],
	});

	// Start Game button
	createUiButton({
		pos: k.vec2(center.x, startY),
		txt: "START GAME",
		size: k.vec2(buttonWidth, compact ? 42 : 50),
		tags: [tags.mainMenu],
		onClick: () => {
			clearMainMenu();
			changeGameState(GameState.Playing);
		},
	});

	// Level Editor button
	createUiButton({
		pos: k.vec2(center.x, editorY),
		txt: "LEVEL EDITOR",
		size: k.vec2(buttonWidth, compact ? 42 : 50),
		tags: [tags.mainMenu],
		onClick: () => {
			clearMainMenu();
			changeGameState(GameState.LevelEditor);
		},
	});

	createVolumeControls({
		center,
		startY: volumeY,
		width: fitUiWidth(220, 45),
		tags: [tags.mainMenu],
	});

	createLifetimeStats(compact);
}

export function updateMainMenuLoop() {
	// Main menu update logic (if needed)
}

export function clearMainMenu() {
	k.destroyAll(tags.mainMenu);
}

function createLifetimeStats(compact: boolean) {
	const stats = getLifetimeStats();
	const panelWidth = compact ? fitUiWidth(230, 12) : 230;
	const panelPos = compact
		? k.vec2(k.center().x, 84)
		: k.vec2(k.center().x - 277, k.center().y + 70);
	const panel = createUiPanel({
		pos: panelPos,
		size: k.vec2(panelWidth, 150),
		title: "LIFETIME STATS",
		tags: [tags.mainMenu],
		anchor: "center",
	});
	const rows = [
		["PLAYTIME", formatPlaytime(stats.playtimeSeconds)],
		["ENEMIES KILLED", formatStat(stats.enemiesKilled)],
		["RUNS", formatStat(stats.runs)],
		["DEBREE COLLECTED", formatStat(stats.debreeCollected)],
	];
	const left = -panelWidth / 2 + 12;
	const right = panelWidth / 2 - 12;
	rows.forEach(([label, value], index) => {
		const y = -39 + index * 28;
		panel.add([
			k.text(label, { size: 8, font: "unscii" }),
			k.pos(left, y),
			k.color(...UI_COLORS.muted),
		]);
		panel.add([
			k.text(value, { size: 9, font: "unscii" }),
			k.pos(right, y),
			k.anchor("right"),
			k.color(...UI_COLORS.accent),
		]);
	});
}

function formatPlaytime(totalSeconds: number) {
	const seconds = Math.floor(totalSeconds);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function formatStat(value: number) {
	return Math.floor(value).toLocaleString("en-US");
}
