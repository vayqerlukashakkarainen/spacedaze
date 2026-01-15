import { Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";

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
	const btnColor = color || { r: 0, g: 0, b: 0 };
	const btn = k.add([
		k.pos(pos),
		k.rect(btnSize.x, btnSize.y),
		k.area(),
		k.color(btnColor.r, btnColor.g, btnColor.b),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		...btnTags,
	]);

	btn.add([
		k.text(txt, { size: 12, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	]);

	btn.onClick(onClick);

	btn.onHover(() => {
		uiState.isOverUI = true;
		if (onHoverStart) onHoverStart();
	});

	btn.onHoverEnd(() => {
		uiState.isOverUI = false;
		if (onHoverEnd) onHoverEnd();
	});
	return btn;
}
