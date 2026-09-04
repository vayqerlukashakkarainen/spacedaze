import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { uiState } from "../uiState"
import { uiHitRegion } from "./hitRegion"
import { createUiSurface } from "./surface"
import { UI_COLORS, UI_SIZES } from "./theme"

export interface UiSelectableCardProps {
	pos: Vec2
	size: Vec2
	selected?: boolean
	disabled?: boolean
	onClick?: () => void
}

export function createUiSelectableCard(
	parent: GameObj,
	props: UiSelectableCardProps
) {
	let selected = props.selected ?? false
	let hovering = false
	const card = createUiSurface(parent, {
		pos: props.pos,
		size: props.size,
		tone: selected ? "selected" : "raised",
		borderColor: selected ? UI_COLORS.accent : UI_COLORS.border,
	})
	card.use(uiHitRegion(props.size))
	const selectionRail = card.add([
		k.pos(0, 0),
		k.rect(props.size.x, UI_SIZES.selectionRail),
		k.color(...UI_COLORS.accent),
		k.opacity(selected ? 1 : 0),
	])

	const syncVisual = () => {
		card.color = k.rgb(...(
			selected || hovering ? UI_COLORS.panelHover : UI_COLORS.panelRaised
		))
		selectionRail.opacity = selected ? 1 : hovering ? 0.45 : 0
	}

	if (!props.disabled) {
		card.onHover(() => {
			uiState.isOverUI = true
			hovering = true
			syncVisual()
		})
		card.onHoverEnd(() => {
			uiState.isOverUI = false
			hovering = false
			syncVisual()
		})
		if (props.onClick) card.onClick(props.onClick)
	}
	card.onDestroy(() => {
		if (hovering) uiState.isOverUI = false
	})

	return {
		obj: card,
		setSelected(value: boolean) {
			selected = value
			syncVisual()
		},
	}
}
