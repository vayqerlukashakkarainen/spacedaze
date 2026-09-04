import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { uiState } from "../uiState"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"
import { uiHitRegion } from "./hitRegion"
import {
	playUiClickSound,
	playUiHoverSound,
} from "../../services/uiSoundService"

export interface UiCommandButtonProps {
	pos: Vec2
	size: Vec2
	index: string
	text: string
	onClick: () => void
	trailingText?: string
	selected?: boolean
	danger?: boolean
	disabled?: boolean
}

export function createUiCommandButton(
	parent: GameObj,
	props: UiCommandButtonProps
) {
	const selected = props.selected ?? false
	const danger = props.danger ?? false
	const disabled = props.disabled ?? false
	const emphasized = selected || danger
	const fill = danger
		? UI_COLORS.danger
		: selected ? UI_COLORS.accent : UI_COLORS.panelRaised
	const foreground = emphasized ? UI_COLORS.background : UI_COLORS.text
	const mutedForeground = emphasized ? UI_COLORS.background : UI_COLORS.muted
	const button = parent.add([
		k.pos(props.pos),
		k.rect(props.size.x, props.size.y),
		uiHitRegion(props.size),
		k.color(...fill),
		k.outline(1, k.rgb(...(emphasized ? fill : UI_COLORS.border))),
	])

	addThemedText(button, {
		pos: k.vec2(14, Math.round((props.size.y - 8) / 2)),
		text: props.index,
		variant: "caption",
		size: UI_FONT_SIZES.tiny,
		color: k.rgb(...(disabled ? UI_COLORS.muted : mutedForeground)),
	})
	addThemedText(button, {
		pos: k.vec2(48, Math.round((props.size.y - 10) / 2)),
		text: props.text,
		variant: "button",
		size: selected ? UI_FONT_SIZES.body : UI_FONT_SIZES.label,
		color: k.rgb(...(disabled ? UI_COLORS.muted : foreground)),
	})
	if (props.trailingText) {
		addThemedText(button, {
			pos: k.vec2(12, Math.round((props.size.y - 8) / 2)),
			text: props.trailingText,
			variant: "caption",
			size: emphasized ? UI_FONT_SIZES.body : UI_FONT_SIZES.tiny,
			width: props.size.x - 24,
			align: "right",
			color: k.rgb(...(disabled ? UI_COLORS.muted : mutedForeground)),
		})
	}

	if (!disabled) {
		button.onClick(() => {
			playUiClickSound()
			props.onClick()
		})
		button.onHover(() => {
			uiState.isOverUI = true
			button.color = k.rgb(...(emphasized ? UI_COLORS.text : UI_COLORS.panelHover))
			playUiHoverSound()
		})
		button.onHoverEnd(() => {
			uiState.isOverUI = false
			button.color = k.rgb(...fill)
		})
	}
	button.onDestroy(() => {
		if (button.isHovering()) uiState.isOverUI = false
	})

	return button
}
