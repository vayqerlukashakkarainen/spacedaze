import type { GameObj } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { createUiCommandButton } from "./commandButton"
import { uiHitRegion } from "./hitRegion"
import { playUiModalClose } from "./modalTransition"
import { createUiPanel } from "./panel"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiConfirmationDialogOptions {
	title: string
	message: string
	confirmText?: string
	cancelText?: string
	onConfirm: () => void
	onCancel?: () => void
}

export interface UiConfirmationDialogController {
	close: () => void
	isOpen: () => boolean
}

const PANEL_SIZE = { x: 460, y: 220 }
const BACKDROP_OPACITY = 0.84

export function showUiConfirmationDialog(
	options: UiConfirmationDialogOptions
): UiConfirmationDialogController {
	k.destroyAll(tags.confirmationDialog)

	const panelPos = k.center()
	const backdrop = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(...UI_COLORS.background),
		k.opacity(BACKDROP_OPACITY),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.animate(),
		uiHitRegion(k.vec2(k.width(), k.height())),
		tags.confirmationDialog,
	])
	const panel = createUiPanel({
		pos: panelPos,
		size: k.vec2(PANEL_SIZE.x, PANEL_SIZE.y),
		anchor: "center",
		layer: layers.uiEffects,
		animated: true,
		tags: [tags.confirmationDialog],
	})
	panel.use(uiHitRegion(k.vec2(PANEL_SIZE.x, PANEL_SIZE.y), true))
	panel.onClick(() => {})

	addThemedText(panel, {
		pos: k.vec2(-204, -82),
		text: "CONFIRM ACTION",
		variant: "eyebrow",
		color: k.rgb(...UI_COLORS.danger),
	})
	addThemedText(panel, {
		pos: k.vec2(-204, -58),
		text: options.title,
		variant: "display",
		size: UI_FONT_SIZES.title,
		width: 408,
	})
	addThemedText(panel, {
		pos: k.vec2(-204, -18),
		text: options.message,
		variant: "body",
		size: UI_FONT_SIZES.small,
		width: 408,
		lineHeight: 1.55,
		color: k.rgb(...UI_COLORS.muted),
	})

	let closing = false
	let open = true
	const escapeController = k.onKeyPress("escape", () => close(false))
	const destroy = () => {
		if (backdrop.exists()) backdrop.destroy()
		if (panel.exists()) panel.destroy()
	}
	const close = (confirmed: boolean) => {
		if (closing || !open) return
		closing = true
		escapeController.cancel()
		void playUiModalClose(backdrop, panel, {
			panelPos,
			backdropOpacity: BACKDROP_OPACITY,
		}).then(() => {
			open = false
			destroy()
			if (confirmed) options.onConfirm()
			else options.onCancel?.()
		})
	}

	createUiCommandButton(panel, {
		pos: k.vec2(-204, 56),
		size: k.vec2(194, 38),
		index: "ESC",
		text: options.cancelText ?? "CANCEL",
		onClick: () => close(false),
	})
	createUiCommandButton(panel, {
		pos: k.vec2(10, 56),
		size: k.vec2(194, 38),
		index: "!",
		text: options.confirmText ?? "CONFIRM",
		danger: true,
		onClick: () => close(true),
	})

	backdrop.onClick(() => close(false))
	backdrop.onDestroy(() => escapeController.cancel())

	return {
		close: () => close(false),
		isOpen: () => open,
	}
}
