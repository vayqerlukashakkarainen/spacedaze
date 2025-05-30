import kaplay, { Vec2 } from "kaplay";
import { init, loadGame, saveGame } from "./util";
import { startGame, updateGameLoop } from "./game";
import { enterLevelUp, updateLevelUpLoop } from "./levelUp";
import { setLoadout } from "./upg";
import { loadPlayer } from "./player";
import { initParticles } from "./particles";

export const layers = {
	bg: "bg",
	game: "game",
	ui: "ui",
};

export const GameState = {
	Playing: 1,
	LevelUp: 2,
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

export const k = kaplay({
	background: "#000000",
	global: false,
	scale: 1.2,
	width: 700,
	height: 700,
});

init(k).then(() => {
	initParticles();
	loadGameSlot();
	k.setLayers([layers.bg, layers.game, layers.ui], layers.game);

	addBorderOffsets();

	changeGameState(GameState.LevelUp);

	k.onUpdate(() => {
		if (gameState == GameState.Playing) {
			timeSeconds += k.dt();
			updateGameLoop();
		} else if (gameState == GameState.LevelUp) {
			updateLevelUpLoop();
		}
	});
});

export function changeGameState(state: number) {
	gameState = state;

	if (gameState == GameState.Playing) {
		startGame();
	} else if (gameState == GameState.LevelUp) {
		saveGame("slot1");
		enterLevelUp();
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
