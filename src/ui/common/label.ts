import { Color, Vec2 } from "kaplay";
import { k, layers } from "../../main";

interface Props {
	pos: Vec2;
	txt: string;
	color: Color;
	fontSize?: number;
	tags?: string[];
}

export function createUiLabel({ pos, txt, color, fontSize, tags }: Props) {
	const labelTags = tags || ["debug"];
	return k.add([
		k.text(txt, { size: fontSize || 12, font: "unscii" }),
		k.pos(pos),
		k.color(color),
		k.fixed(),
		k.anchor("center"),
		k.layer(layers.ui),
		...labelTags,
	]);
}
