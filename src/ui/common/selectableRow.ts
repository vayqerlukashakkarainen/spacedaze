import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { uiState } from "../uiState"
import { addThemedText } from "./text"
import { UI_COLORS, UI_SIZES, UI_SPACING } from "./theme"
import { uiHitRegion } from "./hitRegion"

export interface UiSelectableRowProps {
	pos: Vec2
	width: number
	title: string
	meta?: string
	description?: string
	status?: string
	statusColor?: readonly [number, number, number]
	icon?: string
	iconText?: string
	iconSize?: number
	selected?: boolean
	disabled?: boolean
	notification?: boolean
	height?: number
	onClick?: () => void
}

export function createUiSelectableRow(
	parent: GameObj,
	props: UiSelectableRowProps
) {
	const height = props.height ?? UI_SIZES.row
	let selected = props.selected ?? false
	let hovering = false
	const row = parent.add([
		k.pos(props.pos),
		k.rect(props.width, height),
		uiHitRegion(k.vec2(props.width, height)),
		k.color(...(selected ? UI_COLORS.panelHover : UI_COLORS.panel)),
	])
	const rail = row.add([
		k.rect(UI_SIZES.selectionRail, height),
		k.color(...UI_COLORS.accent),
		k.opacity(selected ? 1 : 0),
	])
	row.add([
		k.pos(0, height - 1),
		k.rect(props.width, 1),
		k.color(...(selected ? UI_COLORS.accent : UI_COLORS.border)),
	])
	const iconSize = props.iconSize ?? 24
	const hasIcon = props.icon !== undefined || props.iconText !== undefined
	const textLeft = hasIcon
		? UI_SPACING.md + iconSize + UI_SPACING.md
		: UI_SPACING.md
	if (props.icon) {
		row.add([
			k.sprite(props.icon, { width: iconSize, height: iconSize }),
			k.pos(UI_SPACING.md + iconSize / 2, height / 2),
			k.anchor("center"),
			k.opacity(props.disabled ? 0.35 : 1),
		])
	}
	if (!props.icon && props.iconText) {
		addThemedText(row, {
			text: props.iconText,
			pos: k.vec2(UI_SPACING.md, height / 2 - 7),
			variant: "muted",
			width: iconSize,
			align: "center",
		})
	}
	addThemedText(row, {
		text: props.title,
		pos: k.vec2(textLeft, props.description ? 5 : props.meta ? 9 : 15),
		variant: props.disabled ? "muted" : "body",
		width: props.width - 100,
	})
	if (props.notification) {
		addThemedText(row, {
			text: "!",
			pos: k.vec2(props.width - UI_SPACING.md, 5),
			variant: "caption",
			align: "right",
			color: k.rgb(...UI_COLORS.warning),
		})
	}
	if (props.meta) {
		addThemedText(row, {
			text: props.meta,
			pos: k.vec2(textLeft, props.description ? 18 : 24),
			variant: "eyebrow",
			width: props.width - 100,
		})
	}
	if (props.description) {
		addThemedText(row, {
			text: props.description,
			pos: k.vec2(textLeft, 31),
			variant: props.disabled ? "muted" : "body",
			width: props.width - textLeft - UI_SPACING.md,
		})
	}
	const statusText = props.status
		? addThemedText(row, {
			text: props.status,
			pos: k.vec2(textLeft, 16),
			variant: selected ? "caption" : "eyebrow",
			width: props.width - textLeft - UI_SPACING.md,
			align: "right",
			color: props.statusColor
				? k.rgb(...props.statusColor)
				: undefined,
		})
		: undefined

	const syncVisual = () => {
		row.color = k.rgb(...(
			selected || hovering ? UI_COLORS.panelHover : UI_COLORS.panel
		))
		rail.opacity = selected ? 1 : 0
		if (statusText) {
			statusText.color = k.rgb(...(
				props.statusColor ?? (
					selected ? UI_COLORS.accent : UI_COLORS.muted
				)
			))
		}
	}
	row.onHover(() => {
		uiState.isOverUI = true
		hovering = true
		syncVisual()
	})
	row.onHoverEnd(() => {
		uiState.isOverUI = false
		hovering = false
		syncVisual()
	})
	if (!props.disabled && props.onClick) row.onClick(props.onClick)

	return {
		obj: row,
		setSelected(value: boolean) {
			selected = value
			syncVisual()
		},
		setStatus(value: string) {
			if (statusText) statusText.text = value
		},
	}
}
