import type { GameObj } from "kaplay"
import { k } from "../../main"
import {
	getInputPromptGlyph,
	getInputPromptKeys,
	type InputPromptAction,
} from "../../services/inputPromptService"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface InputPromptEntry {
	action: InputPromptAction
	label?: string
}

export interface InputPromptRowProps {
	pos: ReturnType<typeof k.vec2>
	prompts: readonly InputPromptEntry[]
	align?: "left" | "center" | "right"
	color?: readonly [number, number, number]
	fontSize?: number
	iconHeight?: number
	promptGap?: number
}

interface PromptElement {
	type: "sprite" | "text"
	value: string
	width: number
	height?: number
}

export function createInputPromptRow(parent: GameObj, {
	pos,
	prompts,
	align = "center",
	color = UI_COLORS.muted,
	fontSize = UI_FONT_SIZES.tiny,
	iconHeight = 24,
	promptGap = 14,
}: InputPromptRowProps) {
	const root = parent.add([
		k.pos(pos),
		k.opacity(1),
	])
	const elements: PromptElement[] = []

	for (const [promptIndex, prompt] of prompts.entries()) {
		if (promptIndex > 0) {
			elements.push({ type: "text", value: "//", width: promptGap + fontSize })
		}
		const keys = getInputPromptKeys(prompt.action)
		for (const [keyIndex, key] of keys.entries()) {
			if (keyIndex > 0) {
				elements.push({ type: "text", value: "/", width: fontSize + 3 })
			}
			const glyph = getInputPromptGlyph(key)
			elements.push({
				type: "sprite",
				value: glyph.sprite,
				width: glyph.width / glyph.height * iconHeight,
				height: iconHeight,
			})
		}
		if (prompt.label) {
			elements.push({
				type: "text",
				value: prompt.label,
				width: prompt.label.length * fontSize + 7,
			})
		}
	}

	const totalWidth = elements.reduce((sum, element) => sum + element.width, 0)
	let cursor = align === "left" ? 0 : align === "right" ? -totalWidth : -totalWidth / 2
	for (const element of elements) {
		const centerX = cursor + element.width / 2
		if (element.type === "sprite") {
			root.add([
				k.sprite(element.value, {
					width: element.width,
					height: element.height,
				}),
				k.pos(centerX, 0),
				k.anchor("center"),
				k.color(...color),
			])
		} else {
			root.add([
				k.text(element.value, { font: "unscii", size: fontSize }),
				k.pos(centerX, 0),
				k.anchor("center"),
				k.color(...color),
			])
		}
		cursor += element.width
	}

	return root
}
