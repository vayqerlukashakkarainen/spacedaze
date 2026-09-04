import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_FONT_SIZES } from "./theme"

export interface UiStatRow {
	label: string
	value: string
}

interface UiStatListProps {
	pos: Vec2
	width: number
	rows: readonly UiStatRow[]
	rowHeight?: number
}

export function createUiStatList(parent: GameObj, props: UiStatListProps) {
	const container = parent.add([k.pos(props.pos)])
	const rowHeight = props.rowHeight ?? 28

	props.rows.forEach((row, index) => {
		const y = index * rowHeight
		addThemedText(container, {
			text: row.label,
			pos: k.vec2(0, y),
			variant: "muted",
			width: props.width,
		})
		addThemedText(container, {
			text: row.value,
			pos: k.vec2(0, y),
			variant: "caption",
			size: UI_FONT_SIZES.small,
			width: props.width,
			align: "right",
		})
	})

	return container
}
