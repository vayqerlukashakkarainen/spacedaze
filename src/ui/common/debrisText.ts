import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiDebrisValue {
	debris: number
}

export type UiDebrisTextPart = string | UiDebrisValue

export interface UiDebrisTextProps {
	parts: readonly UiDebrisTextPart[]
	pos?: Vec2
	size?: number
	color?: Color
	iconColor?: Color
	iconSize?: number
	iconGap?: number
	align?: "left" | "center" | "right"
	verticalAlign?: "top" | "center" | "bottom"
}

interface MeasuredPart {
	text?: string
	width: number
	height: number
	debris?: number
}

/**
 * Draws UI copy containing debris amounts, placing the debris icon directly
 * after every amount. Use a `{ debris: value }` part for each currency value.
 */
export function createUiDebrisText(parent: GameObj, props: UiDebrisTextProps) {
	const size = props.size ?? UI_FONT_SIZES.small
	const color = props.color ?? k.rgb(...UI_COLORS.text)
	const iconColor = props.iconColor ?? color
	const iconSize = props.iconSize ?? Math.max(8, Math.round(size * 0.9))
	const iconGap = props.iconGap ?? 3
	const measuredParts: MeasuredPart[] = []

	for (const part of props.parts) {
		if (typeof part === "string") {
			const measurement = measureText(part, size)
			measuredParts.push({
				text: part,
				width: measurement.width,
				height: measurement.height,
			})
			continue
		}
		const valueText = `${part.debris}`
		const measurement = measureText(valueText, size)
		measuredParts.push({
			debris: part.debris,
			width: measurement.width + iconGap + iconSize,
			height: Math.max(measurement.height, iconSize),
		})
	}

	const width = measuredParts.reduce((total, part) => total + part.width, 0)
	const height = measuredParts.reduce((maximum, part) => Math.max(maximum, part.height), 0)
	const align = props.align ?? "left"
	const verticalAlign = props.verticalAlign ?? "top"
	const startX = align === "center" ? -width / 2 : align === "right" ? -width : 0
	const startY = verticalAlign === "center" ? -height / 2 : verticalAlign === "bottom" ? -height : 0
	const root = parent.add([k.pos(props.pos ?? k.vec2(0, 0))])
	let cursor = startX

	for (const part of measuredParts) {
		if (part.text !== undefined) {
			root.add([
				k.text(part.text, { size, font: "unscii" }),
				k.pos(cursor, startY + (height - part.height) / 2),
				k.color(color),
			])
			cursor += part.width
			continue
		}
		const valueText = `${part.debris}`
		const valueMeasurement = measureText(valueText, size)
		root.add([
			k.text(valueText, { size, font: "unscii" }),
			k.pos(cursor, startY + (height - valueMeasurement.height) / 2),
			k.color(color),
		])
		cursor += valueMeasurement.width + iconGap
		root.add([
			k.sprite("salvage_shard", { width: iconSize, height: iconSize }),
			k.pos(cursor + iconSize / 2, startY + height / 2),
			k.anchor("center"),
			k.color(iconColor),
		])
		cursor += iconSize
	}

	return root
}

function measureText(text: string, size: number) {
	return k.formatText({
		text,
		size,
		font: "unscii",
	})
}
