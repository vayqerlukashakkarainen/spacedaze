import { Vec2 } from "kaplay";
import { k, layers, changeGameState, GameState } from "../../main";
import { uiState } from "../../ui/uiState";
import { createUiButton } from "../../ui/common/button";
import { createUiLabel } from "../../ui/common/label";
import { uiHitRegion } from "../../ui/common/hitRegion";
import { UI_FONT_SIZES } from "../../ui/common/theme";
import {
	clearGrid,
	generateCave,
	saveGridToFile,
	loadGridFromFile,
} from "../actions/gridActions";
import {
	savePattern,
	loadPattern,
	exportPatternJSON,
} from "../actions/patternActions";
import { toggleOutlines } from "../actions/layerActions";
import { exitLevelEditor } from "../levelEditor";

/**
 * Create action button bar (right side)
 */
export function createActionBar(
	paletteX: number,
	startY: number,
	screenHeight: number
): void {
	let paletteY = startY;

	createUiLabel({
		pos: k.vec2(paletteX, paletteY),
		txt: "ACTIONS",
		color: k.Color.fromHex("#ffffff"),
	});
	paletteY += 40;

	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "CLEAR",
		onClick: clearGrid,
	});
	paletteY += 60;

	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "SAVE",
		onClick: saveGridToFile,
	});
	paletteY += 60;

	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "LOAD",
		onClick: loadGridFromFile,
	});
	paletteY += 60;

	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "EXPORT JSON",
		onClick: exportPatternJSON,
	});
	paletteY += 60;

	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "OUTLINES",
		onClick: toggleOutlines,
	});
	paletteY += 80;

	// Seed input for generation
	let seedInputValue = "";
	const seedInputBg = k.add([
		k.pos(paletteX, paletteY),
		k.rect(120, 30),
		uiHitRegion(k.vec2(120, 30), true),
		k.color(20, 20, 20),
		k.anchor("center"),
		k.outline(1, new k.Color(100, 100, 100)),
		k.fixed(),
		k.layer(layers.ui),
		"levelEditor",
	]);

	seedInputBg.onHover(() => {
		uiState.isOverUI = true;
	});

	seedInputBg.onHoverEnd(() => {
		uiState.isOverUI = false;
	});

	const seedInputText = seedInputBg.add([
		k.text("seed: random", { size: UI_FONT_SIZES.label, font: "unscii" }),
		k.anchor("center"),
		k.color(150, 150, 150),
	]);

	// Handle text input
	k.onCharInput((char) => {
		if (char >= "0" && char <= "9") {
			seedInputValue += char;
			if (seedInputValue.length > 8)
				seedInputValue = seedInputValue.slice(0, 8);
			seedInputText.text = `seed: ${seedInputValue}`;
		}
	});

	k.onKeyPress("backspace", () => {
		if (seedInputValue.length > 0) {
			seedInputValue = seedInputValue.slice(0, -1);
			seedInputText.text =
				seedInputValue.length > 0 ? `seed: ${seedInputValue}` : "seed: random";
		}
	});

	paletteY += 50;

	// Generate button
	createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: "GENERATE",
		onClick: () => {
			const seed =
				seedInputValue.length > 0 ? parseInt(seedInputValue) : undefined;
			generateCave(seed);
		},
	});
	paletteY += 80;

	// Exit button
	createUiButton({
		pos: k.vec2(paletteX, screenHeight - 60),
		txt: "EXIT",
		onClick: () => {
			exitLevelEditor();
			changeGameState(GameState.MainMenu);
		},
	});
}
