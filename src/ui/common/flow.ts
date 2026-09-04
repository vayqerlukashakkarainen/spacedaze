import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import {
	addThemedText,
	getScaledLineSpacing,
	getThemedTextStyle,
	type ThemedTextProps,
} from "./text"

export interface UiVerticalFlowProps {
	pos: Vec2
	width?: number
	gap?: number
	onHeightChange?: (height: number) => void
}

export interface FlowTextProps extends Omit<ThemedTextProps, "pos"> {
	minHeight?: number
	gapAfter?: number
}

export interface FlowRowsProps extends Omit<ThemedTextProps, "pos" | "text"> {
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
	const notifyHeightChange = () => props.onHeightChange?.(cursorY)

	return {
		obj: container,
		addItem<T extends GameObj>(item: T, height: number, gapAfter = defaultGap) {
			item.pos = k.vec2(item.pos.x, cursorY)
			cursorY += height + gapAfter
			notifyHeightChange()
			return item
		},
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
			notifyHeightChange()
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
			notifyHeightChange()
			return rowObjects
		},
		addGap(height: number) {
			cursorY += height
			notifyHeightChange()
		},
		getHeight() {
			return cursorY
		},
		setHeight(height: number) {
			cursorY = Math.max(0, height)
			notifyHeightChange()
		},
	}
}

export interface UiHorizontalFlowProps {
	pos: Vec2
	gap?: number
}

export function createUiHorizontalFlow(
	parent: GameObj,
	props: UiHorizontalFlowProps
) {
	const container = parent.add([k.pos(props.pos)])
	let cursorX = 0
	const defaultGap = props.gap ?? 4

	return {
		obj: container,
		addItem<T extends GameObj>(item: T, width: number, gapAfter = defaultGap) {
			item.pos = k.vec2(cursorX, item.pos.y)
			cursorX += width + gapAfter
			return item
		},
		addGap(width: number) {
			cursorX += width
		},
		getWidth() {
			return cursorX
		},
	}
}
