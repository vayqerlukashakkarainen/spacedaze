import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import {
	addThemedText,
	getScaledLineSpacing,
	getThemedTextStyle,
	type ThemedTextProps,
} from "./text"

interface UiVerticalFlowProps {
	pos: Vec2
	width?: number
	gap?: number
}

interface FlowTextProps extends Omit<ThemedTextProps, "pos"> {
	minHeight?: number
	gapAfter?: number
}

interface FlowRowsProps extends Omit<ThemedTextProps, "pos" | "text"> {
	rowHeight?: number
	gapAfter?: number
}

export function createUiVerticalFlow(
	parent: GameObj,
	props: UiVerticalFlowProps
) {
	const container = parent.add([k.pos(props.pos)])
	let cursorY = 0
	const defaultGap = props.gap ?? 4

	return {
		obj: container,
		addText(textProps: FlowTextProps) {
			const variant = textProps.variant ?? "body"
			const textObj = addThemedText(container, {
				...textProps,
				pos: k.vec2(0, cursorY),
				width: textProps.width ?? props.width,
			})
			const style = getThemedTextStyle(variant)
			const size = textProps.size ?? style.size
			const lineSpacing = textProps.lineSpacing ?? getScaledLineSpacing(
				size,
				textProps.lineHeight ?? style.lineHeight
			)
			const measuredHeight = Number.isFinite(textObj.height)
				? textObj.height
				: size + lineSpacing
			cursorY += Math.max(textProps.minHeight ?? 0, measuredHeight)
			cursorY += textProps.gapAfter ?? defaultGap
			return textObj
		},
		addRows(rows: readonly string[], rowProps: FlowRowsProps = {}) {
			const rowHeight = rowProps.rowHeight ?? 11
			const rowObjects = rows.map((text) => {
				const textObj = addThemedText(container, {
					...rowProps,
					text,
					pos: k.vec2(0, cursorY),
					width: rowProps.width ?? props.width,
				})
				cursorY += rowHeight
				return textObj
			})
			cursorY += rowProps.gapAfter ?? defaultGap
			return rowObjects
		},
		addGap(height: number) {
			cursorY += height
		},
		getHeight() {
			return cursorY
		},
	}
}
