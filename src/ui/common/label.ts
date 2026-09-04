import { Color, Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { UI_FONT_SIZES, type UiFontSize } from "./theme";

interface Props {
	pos: Vec2;
	txt: string;
	color: Color;
	fontSize?: UiFontSize;
	tags?: string[];
}

export function createUiLabel({ pos, txt, color, fontSize, tags }: Props) {
	const labelTags = tags || ["debug"];
	return k.add([
		k.text(txt, { size: fontSize ?? UI_FONT_SIZES.body, font: "unscii" }),
		k.pos(pos),
		k.color(color),
		k.fixed(),
		k.anchor("center"),
		k.layer(layers.ui),
		...labelTags,
	]);
}
