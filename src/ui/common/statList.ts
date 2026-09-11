import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText, getScaledLineSpacing } from "./text"
import { UI_FONT_SIZES } from "./theme"

const STAT_COLUMN_GAP = 12
const MAX_LABEL_COLUMN_RATIO = 0.62
const STAT_LINE_HEIGHT = 1.4

export interface UiStatRow {
	label: string
	value: string
	valueColor?: Color
}

interface UiStatListProps {
	pos: Vec2
	width: number
	rows: readonly UiStatRow[]
	rowHeight?: number
	wrapLongRows?: boolean
}

export function createUiStatList(parent: GameObj, props: UiStatListProps) {
	const container = parent.add([k.pos(props.pos)])
	const rowHeight = props.rowHeight ?? 28
	let y = 0

	props.rows.forEach((row) => {
		const labelMetrics = measureStatText(row.label)
		const valueMetrics = measureStatText(row.value)
		const wraps = props.wrapLongRows === true &&
			(
				labelMetrics.width + valueMetrics.width + STAT_COLUMN_GAP > props.width ||
				labelMetrics.width > props.width * MAX_LABEL_COLUMN_RATIO
			)
		const labelColumnWidth = wraps
			? Math.max(1, Math.floor(Math.min(
				props.width - valueMetrics.width - STAT_COLUMN_GAP,
				props.width * MAX_LABEL_COLUMN_RATIO
			)))
			: props.width
		const wrappedLabelMetrics = wraps
			? measureStatText(row.label, labelColumnWidth)
			: labelMetrics
		const valueY = y + Math.round(Math.max(
			0,
			(wrappedLabelMetrics.height - valueMetrics.height) / 2
		))
		addThemedText(container, {
			text: row.label,
			pos: k.vec2(0, y),
			variant: "muted",
			width: labelColumnWidth,
		})
		addThemedText(container, {
			text: row.value,
			pos: k.vec2(0, valueY),
			variant: "caption",
			size: UI_FONT_SIZES.small,
			color: row.valueColor,
			width: props.width,
			align: "right",
		})
		const lineGap = Math.max(0, rowHeight - labelMetrics.height)
		y += wraps
			? Math.ceil(wrappedLabelMetrics.height + lineGap)
			: rowHeight
	})

	return container
}

function measureStatText(text: string, width?: number) {
	return k.formatText({
		text,
		font: "unscii",
		size: UI_FONT_SIZES.small,
		width,
		lineSpacing: getScaledLineSpacing(
			UI_FONT_SIZES.small,
			STAT_LINE_HEIGHT
		),
	})
}
