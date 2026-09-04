import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS } from "./theme"

export type UiSurfaceTone = "default" | "raised" | "selected"

export interface UiSurfaceProps {
	pos: Vec2
	size: Vec2
	anchor?: "topleft" | "center"
	tone?: UiSurfaceTone
	borderColor?: readonly [number, number, number]
	opacity?: number
	tags?: string[]
}

export function createUiSurface(parent: GameObj, props: UiSurfaceProps) {
	const tone = props.tone ?? "default"
	const fill = tone === "raised"
		? UI_COLORS.panelRaised
		: tone === "selected"
			? UI_COLORS.panelHover
			: UI_COLORS.panel
	const border = props.borderColor ?? (
		tone === "selected" ? UI_COLORS.accent : UI_COLORS.border
	)

	return parent.add([
		k.pos(props.pos),
		k.rect(props.size.x, props.size.y),
		k.anchor(props.anchor ?? "topleft"),
		k.color(...fill),
		k.opacity(props.opacity ?? 1),
		k.outline(1, k.rgb(...border)),
		...(props.tags ?? []),
	])
}
