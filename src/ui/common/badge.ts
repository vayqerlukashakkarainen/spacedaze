import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_COLORS } from "./theme"

export interface UiBadgeProps {
	pos: Vec2
	text: string
	width?: number
	color?: readonly [number, number, number]
}

export function createUiBadge(parent: GameObj, props: UiBadgeProps) {
	const width = props.width ?? Math.max(72, props.text.length * 6 + 16)
	const color = props.color ?? UI_COLORS.accent
	const badge = parent.add([
		k.pos(props.pos),
		k.rect(width, 20),
		k.color(...UI_COLORS.background),
		k.outline(1, k.rgb(...color)),
	])
	addThemedText(badge, {
		text: props.text,
		pos: k.vec2(0, 6),
		variant: "caption",
		color: k.rgb(...color),
		width,
		align: "center",
	})
	return badge
}
