import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiBadgeProps {
	pos: Vec2
	text: string
	width?: number
	color?: readonly [number, number, number]
}

export function createUiBadge(parent: GameObj, props: UiBadgeProps) {
	const measuredText = k.formatText({
		text: props.text,
		font: "unscii",
		size: UI_FONT_SIZES.small,
	})
	const contentWidth = Math.ceil(measuredText.width) + 16
	const width = Math.max(72, props.width ?? 0, contentWidth)
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
