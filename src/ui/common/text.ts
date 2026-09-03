import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS } from "./theme"

export type UiTextVariant =
	| "caption"
	| "heading"
	| "body"
	| "muted"
	| "stat"
	| "button"

interface UiTextStyle {
	size: number
	lineHeight: number
	color: readonly [number, number, number]
}

const UI_TEXT_STYLES: Record<UiTextVariant, UiTextStyle> = {
	caption: { size: 8, lineHeight: 1.25, color: UI_COLORS.accent },
	heading: { size: 10, lineHeight: 1.4, color: UI_COLORS.accent },
	body: { size: 8, lineHeight: 1.4, color: [255, 255, 255] },
	muted: { size: 8, lineHeight: 1.4, color: UI_COLORS.muted },
	stat: { size: 8, lineHeight: 1.35, color: [255, 255, 255] },
	button: { size: 10, lineHeight: 1.2, color: [255, 255, 255] },
}

export interface ThemedTextProps {
	text: string
	pos?: Vec2
	variant?: UiTextVariant
	size?: number
	width?: number
	align?: "left" | "center" | "right"
	color?: Color
	lineHeight?: number
	lineSpacing?: number
}

export function addThemedText(parent: GameObj, props: ThemedTextProps) {
	const variant = props.variant ?? "body"
	const style = UI_TEXT_STYLES[variant]
	const color = props.color ?? k.rgb(...style.color)
	const size = props.size ?? style.size
	const lineSpacing = props.lineSpacing ?? getScaledLineSpacing(
		size,
		props.lineHeight ?? style.lineHeight
	)
	return parent.add([
		k.text(props.text, {
			size,
			font: "unscii",
			width: props.width,
			align: props.align,
			lineSpacing,
		}),
		k.pos(props.pos ?? k.vec2(0, 0)),
		k.color(color),
	])
}

export function getThemedTextStyle(variant: UiTextVariant) {
	return UI_TEXT_STYLES[variant]
}

export function getScaledLineSpacing(size: number, lineHeight: number) {
	return Math.max(1, Math.round(size * (lineHeight - 1)))
}
