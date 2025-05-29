import {
	AreaComp,
	GameObj,
	OpacityComp,
	PosComp,
	SpriteComp,
	TextComp,
	Vec2,
} from "kaplay";
import { addScore, changeGameState, GameState, k, score } from "./main";
import { loadPlayer } from "./player";
import { addLvl, getNextLvl, loadout, Tool, ToolKey, upgrades } from "./upg";
import { starsEmitter } from "./particles";

const gridTag = "ui_grid";

interface ToolGroup {
	group?: GameObj<PosComp>;
	title?: GameObj<TextComp>;
	header?: GameObj<TextComp>;
	desc?: GameObj<TextComp>;
	icon?: GameObj<SpriteComp>;
	purchaseBtn?: GameObj<AreaComp | OpacityComp>;
	purchaseBtnText?: GameObj<TextComp>;
}

let selectedTool: { key: ToolKey; index: number };
let toolGroupObj: ToolGroup = {
	group: undefined,
	title: undefined,
	header: undefined,
	desc: undefined,
	icon: undefined,
};
let highlightKeyObj: Record<string, GameObj> = {};
let scoreTxt: GameObj<TextComp>;
let selectedPos: Vec2;

export function enterLevelUp() {
	const center = k.center();

	const g1 = uiGroup(k.vec2(center.x, 40), "ui");

	g1.add([k.text("UPGRADE", { size: 22, font: "unscii" }), k.anchor("center")]);

	scoreTxt = addTextWithBorder(g1, 12, getScoreStr(score), k.vec2(0, 50));

	reloadUpgradeGrid(center);

	toolGroupObj.group = uiGroup(
		k.vec2(center.x + center.x / 2 - 100, center.y - center.y / 2 - 40),
		"ui"
	);
	toolGroupObj.group.hidden = true;
	buildToolUi();

	addBtn("START GAME", k.vec2(center.x, center.y * 2 - 60), () => {
		clearLevelUp();
		changeGameState(GameState.Playing);
	});
}

export function updateLevelUpLoop() {}

export function clearLevelUp() {
	k.destroyAll("ui");
	k.destroyAll(gridTag);
}

function reloadUpgradeGrid(pos: Vec2) {
	k.destroyAll(gridTag);
	const gridGroup = uiGroup(k.vec2(60, pos.y), gridTag);

	var upgs = upgrades;

	var keys = Object.entries(upgs)
		.filter(([_, v]) => {
			if (!v.requiredTool) return true;

			return loadout[v.requiredTool] !== undefined;
		})
		.map(([k, _]) => k) as ToolKey[];

	const maxColumns = 4;
	let row = -1;
	const size = 42;
	const spacing = 8;
	const upgSize = 16;

	for (let i = 0; i < keys.length; i++) {
		const tool = upgrades[keys[i]] as Tool;
		const upgIndex = getNextLvl(keys[i]);

		if (i % maxColumns == 0) {
			row++;
		}

		const col = i - maxColumns * row;

		const btn = gridGroup.add([
			k.pos(k.vec2((size + spacing) * col, (size + spacing) * row)),
			k.rect(size, size),
			k.area(),
			k.color(0, 0, 0),
			k.anchor("center"),
			k.outline(1, new k.Color(255, 255, 255)),
			gridTag,
		]);

		const highlight = btn.add([
			k.rect(size + 6, size + 6),
			k.pos(0, 0),
			k.color(0, 0, 0),
			k.anchor("center"),
			k.outline(2, new k.Color(255, 255, 255)),
			gridTag,
		]);
		highlight.hidden = true;
		highlightKeyObj[keys[i]] = highlight;

		if (upgIndex > 0) {
			const c = btn.add([
				k.pos(upgSize, -size / 2),
				k.rect(upgSize, upgSize),
				k.anchor("center"),
				k.color(255, 255, 255),
			]);
			c.add([
				k.text(`${upgIndex}`, { size: 14, font: "unscii" }),
				k.pos(0, 2),
				k.anchor("center"),
				k.color(0, 0, 0),
			]);
		}

		const clampIndex = k.clamp(upgIndex, 0, tool.upgrades.length - 1);

		btn.add([
			k.sprite(tool.upgrades[clampIndex].sprite, { height: 24, width: 24 }),
			k.anchor("center"),
		]);

		btn.onClick(() => onClick(keys[i], upgIndex, btn.worldPos()!));
	}
}

function onClick(key: ToolKey, upgIndex: number, pos: Vec2) {
	if (selectedTool) {
		highlightKeyObj[selectedTool.key].hidden = true;
	}
	highlightKeyObj[key].hidden = false;
	loadTool(key, upgIndex);
	k.play("click1", { volume: 1 });
	selectedPos = pos;
}

function buildToolUi() {
	const containerWidth = 200;
	const containerHeight = 300;
	toolGroupObj.header = toolGroupObj.group!.add([
		k.text("LEVEL 1", { size: 10, font: "unscii" }),
		k.anchor("top"),
		k.pos(containerWidth / 2, 0),
	]);
	toolGroupObj.title = toolGroupObj.group!.add([
		k.text("BLASTER", { size: 14, font: "unscii" }),
		k.anchor("top"),
		k.pos(containerWidth / 2, 22),
	]);
	const container = toolGroupObj.group!.add([
		k.pos(0, 80),
		k.rect(containerWidth, containerHeight),
		k.color(0, 0, 0),
		k.outline(2, new k.Color(255, 255, 255)),
	]);
	const c2 = container.add([
		k.rect(containerWidth / 2, 60),
		k.color(0, 0, 0),
		k.anchor("center"),
		k.pos(containerWidth / 2, 10),

		k.outline(2, new k.Color(255, 255, 255)),
	]);

	toolGroupObj.icon = c2.add([
		k.sprite("ship", { height: 32, width: 32 }),
		k.anchor("center"),
	]);

	toolGroupObj.desc = container.add([
		k.pos(0, 80),
		k.text("EQUIPE YOUR SHIP WITH A LASER BLASTER, LEFT MOUSE TO FIRE", {
			size: 12,
			font: "unscii",
			width: containerWidth,
			align: "center",
			lineSpacing: 12,
		}),
	]);

	toolGroupObj.purchaseBtn = toolGroupObj.group!.add([
		k.rect(containerWidth + 40, 50),
		k.area(),
		k.opacity(1),
		k.anchor("center"),
		k.pos(containerWidth / 2, containerHeight + 40),
	]);

	toolGroupObj.purchaseBtnText = toolGroupObj.purchaseBtn!.add([
		k.text("PURCHASE 12P", { size: 16, font: "unscii" }),
		k.color(0, 0, 0),
		k.anchor("center"),
	]);

	toolGroupObj.purchaseBtn!.onClick(() => {
		if (toolGroupObj.group!.hidden || toolGroupObj.purchaseBtn?.hidden) return;
		const toPurchase = upgrades[selectedTool.key].upgrades[selectedTool.index];
		if (score < toPurchase.price) {
			k.play("error", { volume: 0.4 });
			return;
		}

		addScore(-toPurchase.price);
		addLvl(selectedTool.key);
		reloadUpgradeGrid(k.center());
		loadTool(selectedTool.key, selectedTool.index + 1);
		starsEmitter.emitter.position = selectedPos;
		starsEmitter.emit(20);
		loadPlayer();
		k.play("purchase1", { volume: 0.8 });
		scoreTxt.text = getScoreStr(score);
	});
}

function loadTool(key: ToolKey, upgIndex: number) {
	const tool = upgrades[key];
	const clampedUpgIndex = k.clamp(upgIndex, 0, tool.upgrades.length - 1);
	toolGroupObj.group!.hidden = false;
	const upg = tool.upgrades[clampedUpgIndex];

	toolGroupObj.title!.text = tool.toolName.toUpperCase();
	toolGroupObj.desc!.text = upg.desc.toUpperCase();
	toolGroupObj.header!.text = upg.name.toUpperCase();
	toolGroupObj.icon!.sprite = upg.sprite;
	selectedTool = {
		key: key,
		index: clampedUpgIndex,
	};

	if (upgIndex != clampedUpgIndex) {
		toolGroupObj.purchaseBtn!.hidden = true;
		return;
	}

	toolGroupObj.purchaseBtnText!.text = `PURCHASE ${upg.price}P`;

	toolGroupObj.purchaseBtn!.hidden = false;
	if (score < upg.price) {
		toolGroupObj.purchaseBtn!.opacity = 0.3;
		return;
	}
	toolGroupObj.purchaseBtn!.opacity = 1;
}

function addBtn(txt: string, pos: Vec2, onClick: () => void) {
	const btn = k.add([
		k.pos(pos),
		k.rect(300, 50),
		k.area(),
		k.color(0, 0, 0),
		k.anchor("center"),
		"ui",
	]);

	btn.add([k.text(txt, { size: 16, font: "unscii" }), k.anchor("center")]);

	btn.onClick(onClick);

	return btn;
}

function addTextWithBorder(group: GameObj, size: number, txt: string, p: Vec2) {
	const b = group.add([
		k.rect(80, 40),
		k.pos(p),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.color(0, 0, 0),
	]);

	const text = b.add([
		k.text(txt, { size: size, font: "unscii" }),
		k.anchor("center"),
	]);
	return text;
}

function uiGroup(pos: Vec2, tag: string) {
	return k.add([k.pos(pos), tag]);
}

function getScoreStr(s: number) {
	return `${s}P`;
}
