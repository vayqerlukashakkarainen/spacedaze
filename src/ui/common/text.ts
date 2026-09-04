import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS } from "./theme"

export type UiTextVariant =
	| "eyebrow"
	| "display"
	| "title"
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
	eyebrow: { size: 8, lineHeight: 1.25, color: UI_COLORS.muted },
	display: { size: 20, lineHeight: 1.15, color: UI_COLORS.text },
	title: { size: 12, lineHeight: 1.25, color: UI_COLORS.text },
	caption: { size: 8, lineHeight: 1.25, color: UI_COLORS.accent },
	heading: { size: 10, lineHeight: 1.4, color: UI_COLORS.accent },
	body: { size: 8, lineHeight: 1.4, color: UI_COLORS.text },
	muted: { size: 8, lineHeight: 1.4, color: UI_COLORS.muted },
	stat: { size: 8, lineHeight: 1.35, color: UI_COLORS.text },
	button: { size: 10, lineHeight: 1.2, color: UI_COLORS.text },
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
	z?: number
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
	const components: any[] = [
		k.text(props.text, {
			size,
			font: "unscii",
			width: props.width,
			align: props.align,
			lineSpacing,
		}),
		k.pos(props.pos ?? k.vec2(0, 0)),
		k.color(color),
	]
	if (props.z !== undefined) components.push(k.z(props.z))
	return parent.add(components)
}

export function getThemedTextStyle(variant: UiTextVariant) {
	return UI_TEXT_STYLES[variant]
}

export function getScaledLineSpacing(size: number, lineHeight: number) {
	return Math.max(1, Math.round(size * (lineHeight - 1)))
}
