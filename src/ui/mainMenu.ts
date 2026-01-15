import { GameObj, PosComp, TextComp, Vec2 } from "kaplay";
import { changeGameState, GameState, k } from "../main";
import { createUiButton } from "./common/button";
import { createUiLabel } from "./common/label";
import { tags } from "../tags";

export function enterMainMenu() {
	const center = k.center();

	// Title
	createUiLabel({
		pos: k.vec2(center.x, center.y - 100),
		txt: "SPACEDAZE",
		color: k.Color.fromHex("#ffffff"),
		fontSize: 32,
		tags: [tags.mainMenu],
	});

	// Start Game button
	createUiButton({
		pos: k.vec2(center.x, center.y),
		txt: "START GAME",
		size: k.vec2(300, 50),
		tags: [tags.mainMenu],
		onClick: () => {
			clearMainMenu();
			changeGameState(GameState.Playing);
		},
	});

	// Level Editor button
	createUiButton({
		pos: k.vec2(center.x, center.y + 80),
		txt: "LEVEL EDITOR",
		size: k.vec2(300, 50),
		tags: [tags.mainMenu],
		onClick: () => {
			clearMainMenu();
			changeGameState(GameState.LevelEditor);
		},
	});
}

export function updateMainMenuLoop() {
	// Main menu update logic (if needed)
}

export function clearMainMenu() {
	k.destroyAll(tags.mainMenu);
}
