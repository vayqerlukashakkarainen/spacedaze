import { Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";
import { UI_COLORS, UI_FONT_SIZES } from "./theme";
import { uiHitRegion } from "./hitRegion";

interface Props {
	pos: Vec2;
	txt: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	width?: number;
	tags?: string[];
}

export interface UiCheckboxControl {
	obj: ReturnType<typeof k.add>;
	isChecked: () => boolean;
	setChecked: (value: boolean, notify?: boolean) => void;
	toggle: () => void;
}

export function createUiCheckbox({
	pos,
	txt,
	checked,
	onChange,
	width = 220,
	tags = ["levelEditor"],
}: Props): UiCheckboxControl {
	const row = k.add([
		k.pos(pos),
		k.rect(width, 36),
		uiHitRegion(k.vec2(width, 36), true),
		k.anchor("center"),
		k.color(...UI_COLORS.panel),
		k.fixed(),
		k.layer(layers.ui),
		...tags,
	]);

	const box = row.add([
		k.pos(-width / 2 + 12, 0),
		k.rect(22, 22),
		k.anchor("center"),
		k.color(...UI_COLORS.background),
		k.outline(2, k.rgb(...UI_COLORS.accent)),
	]);

	const mark = box.add([
		k.text("X", { size: UI_FONT_SIZES.subheading, font: "unscii" }),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(checked ? 1 : 0),
	]);

	row.add([
		k.pos(-width / 2 + 36, 0),
		k.text(txt, { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.anchor("left"),
		k.color(k.WHITE),
	]);

	const control: UiCheckboxControl = {
		obj: row,
		isChecked: () => checked,
		setChecked: (value, notify = true) => {
			if (checked === value) return;
			checked = value;
			mark.opacity = checked ? 1 : 0;
			if (notify) onChange(checked);
		},
		toggle: () => {
			control.setChecked(!checked);
		},
	};

	row.onClick(() => control.toggle());

	row.onHover(() => {
		uiState.isOverUI = true;
		box.color = k.rgb(...UI_COLORS.panelHover);
	});

	row.onHoverEnd(() => {
		uiState.isOverUI = false;
		box.color = k.rgb(...UI_COLORS.background);
	});

	return control;
}
