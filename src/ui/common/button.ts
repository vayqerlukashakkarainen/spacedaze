import { Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";
import { UI_COLORS, UI_FONT_SIZES } from "./theme";
import { uiHitRegion } from "./hitRegion";
import {
	playUiClickSound,
	playUiHoverSound,
} from "../../services/uiSoundService";
import type { InputPromptAction } from "../../services/inputPromptService";
import { createInputPromptRow } from "./inputPrompt";

export interface UiActionButtonProps {
	pos: Vec2;
	text: string;
	onClick: () => void;
	size?: Vec2;
	selected?: boolean;
	disabled?: boolean;
	notification?: boolean;
	icon?: string;
	iconSize?: number;
	promptAction?: InputPromptAction;
}

export function createUiActionButton(parent: ReturnType<typeof k.add>, {
	pos,
	text,
	onClick,
	size = k.vec2(120, 32),
	selected = false,
	disabled = false,
	notification = false,
	icon,
	iconSize = 14,
	promptAction,
}: UiActionButtonProps) {
	const button = parent.add([
		k.pos(pos),
		k.rect(size.x, size.y),
		uiHitRegion(size),
		k.color(...(selected ? UI_COLORS.panelHover : UI_COLORS.panel)),
		k.outline(1, k.rgb(...(selected ? UI_COLORS.accent : UI_COLORS.border))),
	]);
	button.add([
		k.text(text, { size: UI_FONT_SIZES.tiny, font: "unscii" }),
		k.pos(size.x / 2 + (icon || promptAction ? 6 : 0), size.y / 2),
		k.anchor("center"),
		k.color(...(disabled ? UI_COLORS.muted : UI_COLORS.text)),
	]);
	if (notification) {
		button.add([
			k.text("!", { size: UI_FONT_SIZES.tiny, font: "unscii" }),
			k.pos(size.x - 9, 5),
			k.anchor("topright"),
			k.color(...UI_COLORS.warning),
		]);
	}
	if (icon) {
		button.add([
			k.sprite(icon, { width: iconSize, height: iconSize }),
			k.pos(14, size.y / 2),
			k.anchor("center"),
			k.color(...(disabled ? UI_COLORS.muted : UI_COLORS.text)),
		]);
	}
	if (promptAction) {
		createInputPromptRow(button, {
			pos: k.vec2(14, size.y / 2),
			prompts: [{ action: promptAction }],
			align: "center",
			color: disabled ? UI_COLORS.muted : UI_COLORS.text,
			iconHeight: 20,
		})
	}
	if (!disabled) {
		button.onClick(() => {
			playUiClickSound();
			onClick();
		});
		button.onHover(() => {
			uiState.isOverUI = true;
			button.color = k.rgb(...UI_COLORS.panelHover);
			playUiHoverSound();
		});
		button.onHoverEnd(() => {
			uiState.isOverUI = false;
			button.color = k.rgb(...(selected ? UI_COLORS.panelHover : UI_COLORS.panel));
		});
	}
	return button;
}

interface Props {
	pos: Vec2;
	txt: string;
	onClick: () => void;
	size?: Vec2;
	tags?: string[];
	color?: { r: number; g: number; b: number };
	onHoverStart?: () => void;
	onHoverEnd?: () => void;
}

export function createUiButton({
	pos,
	txt,
	onClick,
	size,
	tags,
	color,
	onHoverStart,
	onHoverEnd,
}: Props) {
	const btnSize = size || k.vec2(120, 40);
	const btnTags = tags || ["levelEditor"];
	const btnColor = color || {
		r: UI_COLORS.panel[0],
		g: UI_COLORS.panel[1],
		b: UI_COLORS.panel[2],
	};
	const btn = k.add([
		k.pos(pos),
		k.rect(btnSize.x, btnSize.y),
		uiHitRegion(btnSize, true),
		k.color(btnColor.r, btnColor.g, btnColor.b),
		k.anchor("center"),
		k.outline(2, k.rgb(...UI_COLORS.accent)),
		k.fixed(),
		k.layer(layers.ui),
		...btnTags,
	]);

	btn.add([
		k.text(txt, { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	]);

	btn.onClick(() => {
		playUiClickSound();
		onClick();
	});

	btn.onHover(() => {
		uiState.isOverUI = true;
		btn.color = k.rgb(...UI_COLORS.panelHover);
		playUiHoverSound();
		if (onHoverStart) onHoverStart();
	});

	btn.onHoverEnd(() => {
		uiState.isOverUI = false;
		btn.color = k.rgb(btnColor.r, btnColor.g, btnColor.b);
		if (onHoverEnd) onHoverEnd();
	});
	return btn;
}
