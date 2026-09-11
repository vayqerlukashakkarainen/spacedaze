import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { createUiProgressBar } from "./progressBar"
import { createUiSurface } from "./surface"
import { addThemedText } from "./text"
import { UI_COLORS } from "./theme"
import { playUiElementOpen } from "./modalTransition"

export interface UiUnlockListEntry {
	name: string
	description?: string
	meta?: string
	sprite?: string
}

export interface UiUnlockListProps {
	pos: Vec2
	width: number
	entries: readonly UiUnlockListEntry[]
	rowHeight?: number
	gap?: number
}

export function createUiUnlockList(parent: GameObj, props: UiUnlockListProps) {
	const hasDescriptions = props.entries.some((entry) => entry.description)
	const rowHeight = props.rowHeight ?? (hasDescriptions ? 40 : 18)
	const gap = props.gap ?? 2
	const root = parent.add([k.pos(props.pos)])
	const rows = props.entries.map((entry, index) => {
		const rowPos = k.vec2(0, index * (rowHeight + gap))
		const row = createUiSurface(root, {
			pos: rowPos,
			size: k.vec2(props.width, rowHeight),
			tone: "raised",
			borderColor: UI_COLORS.border,
		})
		row.use(k.animate())
		row.hidden = true
		row.add([
			k.rect(3, rowHeight),
			k.color(...UI_COLORS.success),
		])
		const textX = entry.sprite ? 35 : 9
		if (entry.sprite) {
			row.add([
				k.sprite(entry.sprite, {
					width: hasDescriptions ? 20 : 14,
					height: hasDescriptions ? 20 : 14,
				}),
				k.pos(hasDescriptions ? 20 : 17, rowHeight / 2),
				k.anchor("center"),
				k.color(...UI_COLORS.text),
			])
		}
		addThemedText(row, {
			text: entry.name,
			pos: k.vec2(textX, 4),
			variant: "body",
			width: props.width - textX - (entry.meta ? 70 : 9),
		})
		if (entry.description) {
			addThemedText(row, {
				text: entry.description,
				pos: k.vec2(textX, 20),
				variant: "muted",
				width: props.width - textX - 9,
			})
		}
		if (entry.meta) {
			addThemedText(row, {
				text: entry.meta,
				pos: k.vec2(textX, 4),
				variant: "caption",
				width: props.width - textX - 9,
				align: "right",
				color: k.rgb(...UI_COLORS.success),
			})
		}
		const confirmation = createUiProgressBar(row, {
			pos: k.vec2(3, rowHeight - 2),
			width: props.width - 3,
			height: 2,
			value: 0,
			color: UI_COLORS.success,
		})
		return {
			row,
			rowPos,
			confirmation,
			revealed: false,
		}
	})

	return {
		obj: root,
		contentHeight: rows.length > 0
			? rows.length * (rowHeight + gap) - gap
			: 0,
		reveal(index: number, onReveal?: () => void) {
			const item = rows[index]
			if (!item || item.revealed || !item.row.exists()) return
			item.revealed = true
			item.row.hidden = false
			playUiElementOpen(item.row, {
				pos: item.rowPos,
				travel: 8,
			})
			k.tween(
				0,
				1,
				0.24,
				(value) => {
					if (item.row.exists()) item.confirmation.setValue(value)
				},
				k.easings.easeOutCubic
			)
			onReveal?.()
		},
	}
}
