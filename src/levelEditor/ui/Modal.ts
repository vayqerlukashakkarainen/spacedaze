import { Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../../ui/uiState";
import { createUiLabel } from "../../ui/common/label";
import { createUiButton } from "../../ui/common/button";
import { uiHitRegion } from "../../ui/common/hitRegion";
import { UI_FONT_SIZES } from "../../ui/common/theme";

interface ModalButton {
	text: string;
	onClick: () => void;
}

/**
 * Create a modal dialog
 */
export function createModal(
	title: string,
	content: string,
	buttons: ModalButton[]
): any {
	const screenWidth = k.width();
	const screenHeight = k.height();
	const modalWidth = 400;
	const modalHeight = 200;

	// Dark overlay
	const overlay = k.add([
		k.pos(0, 0),
		k.rect(screenWidth, screenHeight),
		uiHitRegion(k.vec2(screenWidth, screenHeight)),
		k.color(0, 0, 0),
		k.opacity(0.7),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Block painting while modal is open
	uiState.isOverUI = true;

	// Keep uiState.isOverUI true while hovering over overlay
	overlay.onHover(() => {
		uiState.isOverUI = true;
	});

	// Modal background
	const modal = k.add([
		k.pos(screenWidth / 2, screenHeight / 2),
		k.rect(modalWidth, modalHeight),
		k.color(30, 30, 30),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Title
	modal.add([
		k.text(title, { size: UI_FONT_SIZES.heading, font: "unscii" }),
		k.pos(0, -modalHeight / 2 + 30),
		k.color(255, 255, 255),
		k.anchor("center"),
	]);

	// Content
	modal.add([
		k.text(content, { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.pos(0, -20),
		k.color(200, 200, 200),
		k.anchor("center"),
	]);

	// Buttons
	const buttonY = modalHeight / 2 - 40;
	const buttonSpacing = 120;
	const startX = (-(buttons.length - 1) * buttonSpacing) / 2;

	buttons.forEach((btnData, i) => {
		const btn = createUiButton({
			pos: k.vec2(
				screenWidth / 2 + startX + i * buttonSpacing,
				screenHeight / 2 + buttonY
			),
			txt: btnData.text,
			onClick: () => {
				btnData.onClick();
				closeModal();
			},
			size: k.vec2(100, 30),
			tags: ["modal"],
			color: { r: 50, g: 50, b: 50 },
		});
		// Adjust z-index to be above modal
		(btn as any).z = 102;
	});

	function closeModal() {
		uiState.isOverUI = false;
		uiState.modalOpen = false;
		k.destroyAll("modal");
	}

	return { modal, overlay, closeModal };
}

/**
 * Create an input modal
 */
export function createInputModal(
	title: string,
	placeholder: string,
	onSubmit: (value: string) => void,
	onCancel?: () => void
): any {
	const screenWidth = k.width();
	const screenHeight = k.height();
	const modalWidth = 400;
	const modalHeight = 200;

	// Dark overlay
	const overlay = k.add([
		k.pos(0, 0),
		k.rect(screenWidth, screenHeight),
		uiHitRegion(k.vec2(screenWidth, screenHeight)),
		k.color(0, 0, 0),
		k.opacity(0.7),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Block painting while modal is open
	uiState.isOverUI = true;
	uiState.modalOpen = true;

	// Keep uiState.isOverUI true while hovering over overlay
	overlay.onHover(() => {
		uiState.isOverUI = true;
	});

	// Modal background
	const modal = k.add([
		k.pos(screenWidth / 2, screenHeight / 2),
		k.rect(modalWidth, modalHeight),
		k.color(30, 30, 30),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Title
	modal.add([
		k.text(title, { size: UI_FONT_SIZES.heading, font: "unscii" }),
		k.pos(0, -modalHeight / 2 + 30),
		k.color(255, 255, 255),
		k.anchor("center"),
	]);

	// Format label (shows input format)
	modal.add([
		k.text(`Format: ${placeholder}`, { size: UI_FONT_SIZES.label, font: "unscii" }),
		k.pos(0, -30),
		k.color(150, 150, 150),
		k.anchor("center"),
	]);

	// Input box
	let inputValue = "";
	const inputBg = modal.add([
		k.pos(0, 10),
		k.rect(300, 40),
		k.color(20, 20, 20),
		k.anchor("center"),
		k.outline(1, new k.Color(100, 100, 100)),
	]);

	// Focus underline
	const focusUnderline = modal.add([
		k.pos(0, 32),
		k.rect(300, 2),
		k.color(100, 200, 255),
		k.anchor("center"),
		k.opacity(1),
	]);

	const inputText = inputBg.add([
		k.text("", { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	]);

	// Handle text input
	const charHandler = k.onCharInput((char) => {
		if (char.match(/[a-zA-Z0-9_:,.\-]/)) {
			inputValue += char;
			if (inputValue.length > 50) inputValue = inputValue.slice(0, 50);
			inputText.text = inputValue;
		}
	});

	const backspaceHandler = k.onKeyPress("backspace", () => {
		if (inputValue.length > 0) {
			inputValue = inputValue.slice(0, -1);
			inputText.text = inputValue;
		}
	});

	const enterHandler = k.onKeyPress("enter", () => {
		if (inputValue.length > 0) {
			onSubmit(inputValue);
			closeModal();
		}
	});

	const escHandler = k.onKeyPress("escape", () => {
		if (onCancel) onCancel();
		closeModal();
	});

	// Buttons
	const buttonY = modalHeight / 2 - 40;

	const cancelBtn = createUiButton({
		pos: k.vec2(screenWidth / 2 - 60, screenHeight / 2 + buttonY),
		txt: "CANCEL",
		onClick: () => {
			if (onCancel) onCancel();
			closeModal();
		},
		size: k.vec2(100, 30),
		tags: ["modal"],
		color: { r: 50, g: 50, b: 50 },
	});
	(cancelBtn as any).z = 102;

	const submitBtn = createUiButton({
		pos: k.vec2(screenWidth / 2 + 60, screenHeight / 2 + buttonY),
		txt: "OK",
		onClick: () => {
			if (inputValue.length > 0) {
				onSubmit(inputValue);
				closeModal();
			}
		},
		size: k.vec2(100, 30),
		tags: ["modal"],
		color: { r: 50, g: 50, b: 50 },
	});
	(submitBtn as any).z = 102;

	function closeModal() {
		charHandler.cancel();
		backspaceHandler.cancel();
		enterHandler.cancel();
		escHandler.cancel();
		uiState.isOverUI = false;
		uiState.modalOpen = false;
		k.destroyAll("modal");
	}

	return { modal, overlay, closeModal };
}

/**
 * Create a list selection modal
 */
export function createListModal(
	title: string,
	items: string[],
	onSelect: (item: string) => void,
	onCancel?: () => void
): any {
	const screenWidth = k.width();
	const screenHeight = k.height();
	const modalWidth = 400;
	const modalHeight = Math.min(400, 150 + items.length * 35);

	// Dark overlay
	const overlay = k.add([
		k.pos(0, 0),
		k.rect(screenWidth, screenHeight),
		uiHitRegion(k.vec2(screenWidth, screenHeight)),
		k.color(0, 0, 0),
		k.opacity(0.7),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Block painting while modal is open
	uiState.isOverUI = true;

	// Keep uiState.isOverUI true while hovering over overlay
	overlay.onHover(() => {
		uiState.isOverUI = true;
	});

	// Modal background
	const modal = k.add([
		k.pos(screenWidth / 2, screenHeight / 2),
		k.rect(modalWidth, modalHeight),
		k.color(30, 30, 30),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		"modal",
	]);

	// Title
	modal.add([
		k.text(title, { size: UI_FONT_SIZES.heading, font: "unscii" }),
		k.pos(0, -modalHeight / 2 + 30),
		k.color(255, 255, 255),
		k.anchor("center"),
	]);

	// List items
	const listStartY = -modalHeight / 2 + 70;
	items.forEach((item, i) => {
		const itemBtn = createUiButton({
			pos: k.vec2(screenWidth / 2, screenHeight / 2 + listStartY + i * 35),
			txt: item,
			onClick: () => {
				onSelect(item);
				closeModal();
			},
			size: k.vec2(350, 30),
			tags: ["modal"],
			color: { r: 50, g: 50, b: 50 },
			onHoverStart: () => {
				(itemBtn as any).color = k.Color.fromHex("#505050");
			},
			onHoverEnd: () => {
				(itemBtn as any).color = k.Color.fromHex("#323232");
			},
		});
	});

	// Cancel button
	const cancelBtn = createUiButton({
		pos: k.vec2(screenWidth / 2, screenHeight / 2 + modalHeight / 2 - 40),
		txt: "CANCEL",
		onClick: () => {
			if (onCancel) onCancel();
			closeModal();
		},
		size: k.vec2(100, 30),
		tags: ["modal"],
		color: { r: 50, g: 50, b: 50 },
	});

	const escHandler = k.onKeyPress("escape", () => {
		if (onCancel) onCancel();
		closeModal();
	});

	function closeModal() {
		escHandler.cancel();
		uiState.isOverUI = false;
		uiState.modalOpen = false;
		k.destroyAll("modal");
	}

	return { modal, overlay, closeModal };
}
