import { GameObj, TextComp, TextInputComp } from "kaplay";
import { k, layers } from "../main";
import { commandService } from "../services/commandService";
import { tags } from "../tags";
import { uiState } from "./uiState";
import {
	ConsoleInlineSprite,
	formatConsoleMarkdownWithSprites,
} from "./consoleMarkdown";
import {
	createUiScrollable,
	UiScrollableControl,
} from "./common/scrollable";

let isOpen = false;
let history: string[] = [];
let historyIndex = 0;
let outputLines = ["Type help to list commands."];
let inputObj: GameObj<TextComp | TextInputComp> | null = null;
let outputObj: GameObj<TextComp> | null = null;
let outputSpriteObjs: GameObj[] = [];
let outputScroll: UiScrollableControl | null = null;
let outputViewportWidth = 0;

export function showCommandConsole() {
	if (isOpen) return;
	isOpen = true;
	commandService.setCapturingInput(true);
	uiState.modalOpen = true;

	const consoleHeight = Math.min(600, k.height() * 0.85);
	const consoleWidth = Math.min(1100, k.width() - 40);
	outputViewportWidth = consoleWidth - 32;

	k.add([
		k.rect(consoleWidth, consoleHeight),
		k.pos(20, 20),
		k.color(0, 0, 0),
		k.opacity(0.94),
		k.outline(2, k.WHITE),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.commandConsole,
	]);

	outputScroll = createUiScrollable({
		pos: k.vec2(36, 36),
		width: outputViewportWidth,
		height: consoleHeight - 92,
		layer: layers.uiEffects,
		tags: [tags.commandConsole],
	});

	const initialOutput = formatConsoleOutput();
	outputObj = outputScroll.content.add([
		k.text(initialOutput.text, {
			font: "unscii",
			size: 9,
			lineSpacing: 2,
		}),
		k.pos(0, 0),
		k.color(k.WHITE),
		tags.commandConsole,
	]);
	refreshConsoleOutput(true);

	inputObj = k.add([
		k.text("> ", {
			font: "unscii",
			size: 18,
			width: consoleWidth - 32,
		}),
		k.textInput(true, 100),
		k.pos(36, 20 + consoleHeight - 38),
		k.color(k.WHITE),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.commandConsole,
	]);

	inputObj.onInput(() => {
		if (!inputObj) return;
		inputObj.typedText = inputObj.typedText.replaceAll("\t", "");
		inputObj.text = escapeStyledText(`> ${inputObj.typedText}`);
	});

	pauseGameObjects(true);
}

export function hideCommandConsole() {
	if (!isOpen) return;
	isOpen = false;
	commandService.setCapturingInput(false);
	uiState.modalOpen = false;
	if (outputScroll) outputScroll.destroy();
	outputScroll = null;
	inputObj = null;
	outputObj = null;
	outputSpriteObjs = [];
	k.destroyAll(tags.commandConsole);
	pauseGameObjects(false);
}

export function toggleCommandConsole() {
	if (isOpen) {
		hideCommandConsole();
	} else {
		showCommandConsole();
	}
}

export function commandConsoleOpen() {
	return isOpen;
}

export function submitCommand() {
	if (!inputObj) return;
	const input = inputObj.typedText.trim();
	if (!input) return;

	history.push(input);
	historyIndex = history.length;
	outputLines.push(`> ${input}`);

	try {
		const result = commandService.execute(input);
		if (result) outputLines.push(result);
	} catch (error) {
		outputLines.push(error instanceof Error ? error.message : String(error));
	}

	refreshConsoleOutput(true);
	if (inputObj) {
		inputObj.typedText = "";
		inputObj.text = "> ";
	}
}

function refreshConsoleOutput(scrollToEnd: boolean) {
	if (!outputObj || !outputScroll) return;
	const output = formatConsoleOutput();
	outputObj.text = output.text;
	const longestLine = output.text
		.split("\n")
		.reduce((longest, line) => Math.max(longest, [...line].length), 0);
	outputScroll.setContentWidth(
		Math.max(outputViewportWidth, longestLine * 9 + 12)
	);
	renderConsoleSprites(output.sprites);
	outputScroll.setContentHeight(outputObj.height + 8, scrollToEnd);
}

function renderConsoleSprites(sprites: ConsoleInlineSprite[]) {
	if (!outputScroll) return;
	for (const spriteObj of outputSpriteObjs) k.destroy(spriteObj);
	outputSpriteObjs = sprites.map((inlineSprite) => {
		return outputScroll!.content.add([
			k.sprite(inlineSprite.sprite),
			k.pos(
				inlineSprite.column * 9 + 4.5,
				inlineSprite.line * 11 + 4.5
			),
			k.anchor("center"),
			k.scale(0.7),
			tags.commandConsole,
		]);
	});
}

export function scrollCommandConsole(amount: number) {
	if (!isOpen || !outputScroll) return;
	outputScroll.scrollBy(amount);
}

export function scrollCommandConsoleToStart() {
	if (!isOpen || !outputScroll) return;
	outputScroll.scrollToStart();
}

export function scrollCommandConsoleToEnd() {
	if (!isOpen || !outputScroll) return;
	outputScroll.scrollToEnd();
}

export function moveCommandHistory(direction: -1 | 1) {
	if (!inputObj || history.length === 0) return;
	historyIndex = k.clamp(historyIndex + direction, 0, history.length);
	inputObj.typedText = history[historyIndex] ?? "";
	inputObj.text = escapeStyledText(`> ${inputObj.typedText}`);
}

function formatConsoleOutput() {
	const output = formatConsoleMarkdownWithSprites(
		outputLines.join("\n"),
		Number.POSITIVE_INFINITY
	);
	return {
		...output,
		text: escapeStyledText(output.text),
	};
}

function escapeStyledText(value: string) {
	return value.replaceAll("\\", "\\\\").replaceAll("[", "\\[");
}

function pauseGameObjects(paused: boolean) {
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		obj.paused = paused;
	}
}
