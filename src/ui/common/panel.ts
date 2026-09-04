import { Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { UI_COLORS } from "./theme"

interface UiPanelProps {
	pos: Vec2
	size: Vec2
	title?: string
	tags?: string[]
	layer?: string
	anchor?: "topleft" | "center"
	frameless?: boolean
	scale?: number
	animated?: boolean
}

export function createUiPanel({
	pos,
	size,
	title,
	tags = [],
	layer = layers.ui,
	anchor = "topleft",
	frameless = false,
	scale = 1,
	animated = false,
}: UiPanelProps) {
	const panel = frameless
		? k.add([
			k.pos(pos),
			k.scale(scale),
			k.fixed(),
			k.layer(layer),
			...(animated ? [k.animate()] : []),
			...tags,
		])
		: k.add([
			k.rect(size.x, size.y),
			k.pos(pos),
			k.scale(scale),
			k.anchor(anchor),
			k.color(...UI_COLORS.panel),
			k.opacity(0.92),
			k.outline(1, k.rgb(...UI_COLORS.accent)),
			k.fixed(),
			k.layer(layer),
			...(animated ? [k.animate()] : []),
			...tags,
		])

	const top = anchor === "center" ? -size.y / 2 : 0
	const left = anchor === "center" ? -size.x / 2 : 0
	if (!frameless) {
		panel.add([
			k.rect(size.x - 2, 2),
			k.pos(left + 1, top + 1),
			k.color(...UI_COLORS.accent),
		])
	}

	if (title) {
		panel.add([
			k.text(title, { size: 8, font: "unscii" }),
			k.pos(left + 8, top + 8),
			k.color(...UI_COLORS.accent),
		])
	}

	return panel
}
