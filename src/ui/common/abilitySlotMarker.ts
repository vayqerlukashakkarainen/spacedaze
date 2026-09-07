import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { addThemedText } from "./text"
import { UI_COLORS } from "./theme"

export type UiAbilitySlot = "primary" | "secondary" | "mobility" | "ultimate"

const MOBILITY_COLOR = [70, 150, 255] as const

export interface AbilitySlotMarkerProps {
	pos: Vec2
	slot: UiAbilitySlot
	color: readonly [number, number, number]
}

export function createAbilitySlotMarker(
	parent: GameObj,
	props: AbilitySlotMarkerProps
) {
	const markerColor = props.slot === "mobility"
		? MOBILITY_COLOR
		: props.slot === "ultimate"
			? UI_COLORS.danger
			: props.color
	const marker = parent.add([
		k.pos(props.pos),
		k.z(8),
	])
	marker.add([
		k.rect(112, 32),
		k.pos(0, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.background),
		k.outline(1, k.rgb(...markerColor)),
	])
	addThemedText(marker, {
		text: props.slot.toUpperCase(),
		pos: k.vec2(-56, -4),
		variant: "caption",
		width: 112,
		align: "center",
		color: k.rgb(...UI_COLORS.text),
		z: 1,
	})
	return marker
}
