import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface UiThrusterPartValue {
	thrusterParts: number
}

export type UiThrusterPartTextPart = string | UiThrusterPartValue

export interface UiThrusterPartTextProps {
	parts: readonly UiThrusterPartTextPart[]
	pos?: Vec2
	size?: number
	color?: Color
	valueColor?: Color
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
	thrusterParts?: number
}

export function createUiThrusterPartText(
	parent: GameObj,
	props: UiThrusterPartTextProps
) {
	const size = props.size ?? UI_FONT_SIZES.small
	const color = props.color ?? k.rgb(...UI_COLORS.text)
	const valueColor = props.valueColor ?? k.rgb(...UI_COLORS.thrusterPart)
	const iconColor = props.iconColor ?? valueColor
	const iconSize = props.iconSize ?? Math.max(8, Math.round(size * 1.05))
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
		const valueText = `${part.thrusterParts}`
		const measurement = measureText(valueText, size)
		measuredParts.push({
			thrusterParts: part.thrusterParts,
			width: measurement.width + iconGap + iconSize,
			height: Math.max(measurement.height, iconSize),
		})
	}

	const width = measuredParts.reduce((total, part) => total + part.width, 0)
	const height = measuredParts.reduce((maximum, part) =>
		Math.max(maximum, part.height), 0)
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
		const valueText = `${part.thrusterParts}`
		const valueMeasurement = measureText(valueText, size)
		root.add([
			k.text(valueText, { size, font: "unscii" }),
			k.pos(cursor, startY + (height - valueMeasurement.height) / 2),
			k.color(valueColor),
		])
		cursor += valueMeasurement.width + iconGap
		root.add([
			k.sprite("thruster_part", { width: iconSize, height: iconSize }),
			k.pos(cursor + iconSize / 2, startY + height / 2),
			k.anchor("center"),
			k.color(iconColor),
		])
		cursor += iconSize
	}

	return root
}

function measureText(text: string, size: number) {
	return k.formatText({ text, size, font: "unscii" })
}
