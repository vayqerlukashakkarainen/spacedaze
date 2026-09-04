import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { createUiGrowingContainer } from "./growingContainer"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiDetailCardProps {
	pos: Vec2
	width: number
	minHeight?: number
	title: string
	meta?: string
	description?: string
	sectionTitle?: string
	rows?: readonly string[]
	icon?: string
	accent?: Color
	anchor?: "topleft" | "center"
	opacity?: number
	frameless?: boolean
	iconBorder?: boolean
}

export function createUiDetailCard(
	parent: GameObj,
	props: UiDetailCardProps
) {
	const accent = props.accent ?? k.rgb(...UI_COLORS.accent)
	const anchor = props.anchor ?? "topleft"
	const iconColumnWidth = props.icon ? 48 : 0
	const container = createUiGrowingContainer(parent, {
		pos: props.pos,
		width: props.width,
		minHeight: props.minHeight,
		padding: {
			top: 12,
			right: 14,
			bottom: 12,
			left: 14 + iconColumnWidth,
		},
		gap: 3,
		anchor,
		borderColor: [accent.r, accent.g, accent.b],
		opacity: props.opacity ?? 0.96,
	})
	container.surface.outline.width = props.frameless ? 0 : 2

	container.flow.addText({
		text: props.title,
		variant: "heading",
		color: k.WHITE,
		size: UI_FONT_SIZES.subheading,
		gapAfter: props.meta ? 3 : 7,
	})
	if (props.meta) {
		container.flow.addText({
			text: props.meta,
			variant: "caption",
			color: accent,
			size: UI_FONT_SIZES.label,
			gapAfter: 7,
		})
	}
	if (props.description) {
		container.flow.addText({
			text: props.description,
			variant: "body",
			color: k.WHITE,
			size: UI_FONT_SIZES.body,
			lineHeight: 1.3,
			gapAfter: props.rows?.length ? 9 : 0,
		})
	}
	if (props.sectionTitle && props.rows?.length) {
		container.flow.addText({
			text: props.sectionTitle,
			variant: "caption",
			color: accent,
			size: UI_FONT_SIZES.label,
			gapAfter: 3,
		})
	}
	for (const row of props.rows ?? []) {
		container.flow.addText({
			text: row,
			variant: "stat",
			color: k.WHITE,
			size: UI_FONT_SIZES.body,
			lineHeight: 1.25,
			gapAfter: 2,
		})
	}

	const height = container.getHeight()
	const left = anchor === "center" ? -props.width / 2 : 0
	const top = anchor === "center" ? -height / 2 : 0
	const rail = container.obj.add([
		k.pos(left + 3, top + 3),
		k.rect(3, height - 6),
		k.color(accent),
	])
	const iconFrame = props.icon && props.iconBorder
		? container.obj.add([
			k.pos(left + 31, top + 31),
			k.rect(38, 38),
			k.anchor("center"),
			k.color(...UI_COLORS.panel),
			k.opacity(props.opacity ?? 0.96),
			k.outline(1, accent),
		])
		: undefined
	const icon = props.icon
		? container.obj.add([
			k.sprite(props.icon, { width: 30, height: 30 }),
			k.pos(left + 31, top + 31),
			k.anchor("center"),
			k.color(accent),
		])
		: undefined

	return {
		...container,
		rail,
		iconFrame,
		icon,
	}
}
