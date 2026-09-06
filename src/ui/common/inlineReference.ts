import type { Color, FormattedText, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"

export const INLINE_REFERENCE_ICON_SIZE = 22
export const INLINE_REFERENCE_GAP = 3

interface InlineReferenceTextOptions {
	font: string
	fontSize: number
	iconSize?: number
	gap?: number
}

interface UiInlineReferenceProps {
	bodyPos: Vec2
	formattedText: FormattedText
	segmentStart: number
	labelStart: number
	labelEnd: number
	sprite: string
	color: Color
	iconSize?: number
	revealAt?: number
}

const prefixCache = new Map<string, string>()

export function formatUiInlineReferenceText(
	label: string,
	options: InlineReferenceTextOptions
) {
	const iconSize = options.iconSize ?? INLINE_REFERENCE_ICON_SIZE
	const gap = options.gap ?? INLINE_REFERENCE_GAP
	const cacheKey = `${options.font}:${options.fontSize}:${iconSize}:${gap}`
	let prefix = prefixCache.get(cacheKey)
	if (!prefix) {
		const sample = k.formatText({
			text: "M M",
			font: options.font,
			size: options.fontSize,
		})
		const first = sample.chars[0]
		const third = sample.chars[2]
		const spaceAdvance = first && third
			? Math.max(1, (third.pos.x - first.pos.x) / 2)
			: Math.max(1, options.fontSize * 0.58)
		const slotWidth = iconSize + gap
		prefix = " ".repeat(Math.max(1, Math.ceil(slotWidth / spaceAdvance)))
		prefixCache.set(cacheKey, prefix)
	}
	return `${prefix}${label}`
}

export function createUiInlineReference(
	parent: GameObj,
	props: UiInlineReferenceProps
) {
	const iconSize = props.iconSize ?? INLINE_REFERENCE_ICON_SIZE
	const labelChars = props.formattedText.chars.slice(
		props.labelStart,
		props.labelEnd
	)
	const firstLabel = labelChars[0]
	if (!firstLabel) return undefined
	const slotChars = props.formattedText.chars.slice(
		props.segmentStart,
		props.labelStart
	)
	const slotLeft = slotChars.length > 0
		? Math.min(...slotChars.map((character) =>
			character.pos.x - character.width / 2
		))
		: firstLabel.pos.x - iconSize - INLINE_REFERENCE_GAP
	const slotRight = firstLabel.pos.x - firstLabel.width / 2
	const slotWidth = Math.max(iconSize, slotRight - slotLeft)
	const icon = parent.add([
		k.pos(
			props.bodyPos.x + slotRight - slotWidth / 2,
			props.bodyPos.y + firstLabel.pos.y - iconSize * 0.06
		),
		k.sprite(props.sprite, { width: iconSize, height: iconSize }),
		k.anchor("center"),
		k.color(props.color),
		k.z(4),
		{
			revealAt: props.revealAt ?? props.labelStart,
		},
	])
	return icon
}
