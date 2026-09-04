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
	status?: string
	selected?: boolean
	disabled?: boolean
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
	const textLeft = UI_SPACING.md
	addThemedText(row, {
		text: props.title,
		pos: k.vec2(textLeft, props.meta ? 9 : 15),
		variant: props.disabled ? "muted" : "body",
		width: props.width - 100,
	})
	if (props.meta) {
		addThemedText(row, {
			text: props.meta,
			pos: k.vec2(textLeft, 24),
			variant: "eyebrow",
			width: props.width - 100,
		})
	}
	const statusText = props.status
		? addThemedText(row, {
			text: props.status,
			pos: k.vec2(textLeft, 16),
			variant: selected ? "caption" : "eyebrow",
			width: props.width - UI_SPACING.xl,
			align: "right",
		})
		: undefined

	const syncVisual = () => {
		row.color = k.rgb(...(
			selected || hovering ? UI_COLORS.panelHover : UI_COLORS.panel
		))
		rail.opacity = selected ? 1 : 0
		if (statusText) {
			statusText.color = k.rgb(...(
				selected ? UI_COLORS.accent : UI_COLORS.muted
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
