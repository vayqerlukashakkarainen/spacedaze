import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { UI_COLORS } from "./theme"

export interface UiProgressBarProps {
	pos: Vec2
	width: number
	value: number
	height?: number
	color?: readonly [number, number, number]
}

export function createUiProgressBar(parent: GameObj, props: UiProgressBarProps) {
	const height = props.height ?? 4
	const track = parent.add([
		k.pos(props.pos),
		k.rect(props.width, height),
		k.color(...UI_COLORS.border),
	])
	const fill = track.add([
		k.rect(props.width * k.clamp(props.value, 0, 1), height),
		k.color(...(props.color ?? UI_COLORS.accent)),
	])

	return {
		obj: track,
		setValue(value: number) {
			fill.width = props.width * k.clamp(value, 0, 1)
		},
	}
}
