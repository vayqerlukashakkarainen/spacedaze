import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiTelemetryItem {
	label: string
	value: string
	valueColor?: Color
}

export interface UiTelemetryStripProps {
	pos: Vec2
	width: number
	items: readonly UiTelemetryItem[]
	gap?: number
}

export function createUiTelemetryStrip(
	parent: GameObj,
	props: UiTelemetryStripProps
) {
	const container = parent.add([k.pos(props.pos)])
	if (props.items.length === 0) return container
	const gap = props.gap ?? 12
	const columnWidth = (
		props.width - gap * (props.items.length - 1)
	) / props.items.length

	props.items.forEach((item, index) => {
		const x = index * (columnWidth + gap)
		addThemedText(container, {
			pos: k.vec2(x, 0),
			text: item.label,
			variant: "eyebrow",
			width: columnWidth,
		})
		addThemedText(container, {
			pos: k.vec2(x, 15),
			text: item.value,
			variant: "stat",
			size: UI_FONT_SIZES.small,
			width: columnWidth,
			color: item.valueColor ?? k.rgb(...UI_COLORS.text),
		})
	})

	return container
}
