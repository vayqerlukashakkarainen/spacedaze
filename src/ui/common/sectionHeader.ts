import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_COLORS, UI_SIZES, UI_SPACING } from "./theme"

export interface UiSectionHeaderProps {
	pos: Vec2
	width: number
	title: string
	eyebrow?: string
	action?: string
	height?: number
}

export function createUiSectionHeader(
	parent: GameObj,
	props: UiSectionHeaderProps
) {
	const height = props.height ?? UI_SIZES.header
	const header = parent.add([k.pos(props.pos)])
	header.add([
		k.pos(0, height - 1),
		k.rect(props.width, 1),
		k.color(...UI_COLORS.border),
	])
	const titleY = props.eyebrow ? 23 : 18
	if (props.eyebrow) {
		addThemedText(header, {
			text: props.eyebrow,
			pos: k.vec2(UI_SPACING.md, UI_SPACING.sm),
			variant: "eyebrow",
			width: props.width - UI_SPACING.xl,
		})
	}
	addThemedText(header, {
		text: props.title,
		pos: k.vec2(UI_SPACING.md, titleY),
		variant: "title",
		width: props.width - UI_SPACING.xl,
	})
	if (props.action) {
		addThemedText(header, {
			text: props.action,
			pos: k.vec2(UI_SPACING.md, titleY + 1),
			variant: "caption",
			width: props.width - UI_SPACING.xl,
			align: "right",
		})
	}
	return header
}
