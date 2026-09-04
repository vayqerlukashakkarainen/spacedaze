import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { createInputPromptRow } from "./inputPrompt"
import { createUiSurface } from "./surface"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"

export interface InteractionPromptContent {
	title: string
	action: string
	detailLeft?: string
	detailRight?: string
	notification?: boolean
}

export type InteractionPromptSource =
	| InteractionPromptContent
	| (() => InteractionPromptContent)

interface InteractionPromptOptions {
	target: GameObj
	offset: Vec2
	content: InteractionPromptSource
	width?: number
}

const DEFAULT_PROMPT_WIDTH = 220
const PROMPT_HEIGHT = 76
const PROMPT_SCALE = 0.8

export function createInteractionPrompt({
	target,
	offset,
	content,
	width = DEFAULT_PROMPT_WIDTH,
}: InteractionPromptOptions) {
	let reveal = 0
	let renderedContent = ""
	const root = k.add([
		k.pos(target.pos.add(offset)),
		k.scale(PROMPT_SCALE * 0.9),
		k.opacity(0),
		k.layer(layers.gameText),
		k.z(200),
		tags.gameLoop,
	])
	root.hidden = true
	createUiSurface(root, {
		pos: k.vec2(0, 0),
		size: k.vec2(width, PROMPT_HEIGHT),
		anchor: "center",
		borderColor: UI_COLORS.accent,
		opacity: 0.97,
	})
	const title = addThemedText(root, {
		text: "",
		pos: k.vec2(-width / 2 + 10, -PROMPT_HEIGHT / 2 + 8),
		variant: "eyebrow",
		size: UI_FONT_SIZES.micro,
		width: width - 20,
		color: k.rgb(...UI_COLORS.text),
	})
	const notification = addThemedText(root, {
		text: "!",
		pos: k.vec2(width / 2 - 10, -PROMPT_HEIGHT / 2 + 8),
		variant: "eyebrow",
		size: UI_FONT_SIZES.micro,
		align: "right",
		color: k.rgb(...UI_COLORS.warning),
	})
	notification.hidden = true
	const action = addThemedText(root, {
		text: "",
		pos: k.vec2(-width / 2 + 10, -12),
		variant: "title",
		width: width - 58,
	})
	createInputPromptRow(root, {
		pos: k.vec2(width / 2 - 20, -6),
		prompts: [{ action: "interact" }],
		color: UI_COLORS.text,
		iconHeight: 18,
	})
	for (const y of [17, 21]) {
		root.add([
			k.rect(width - 20, 2),
			k.pos(-width / 2 + 10, y),
			k.color(...UI_COLORS.border),
		])
	}
	const detailLeft = addThemedText(root, {
		text: "",
		pos: k.vec2(-width / 2 + 10, 28),
		variant: "muted",
		size: UI_FONT_SIZES.micro,
		width: width / 2 - 16,
	})
	const detailRight = addThemedText(root, {
		text: "",
		pos: k.vec2(8, 28),
		variant: "caption",
		size: UI_FONT_SIZES.micro,
		width: width / 2 - 16,
		align: "right",
	})

	function resolveContent() {
		return typeof content === "function" ? content() : content
	}

	function render() {
		const next = resolveContent()
		const signature = JSON.stringify(next)
		if (signature === renderedContent) return
		renderedContent = signature
		title.text = next.title.toUpperCase()
		action.text = next.action.toUpperCase()
		detailLeft.text = (next.detailLeft ?? "").toUpperCase()
		detailRight.text = (next.detailRight ?? "").toUpperCase()
		notification.hidden = !next.notification
	}

	target.onDestroy(() => {
		if (root.exists()) k.destroy(root)
	})

	return {
		update(visible: boolean) {
			if (!root.exists() || !target.exists()) return
			if (!visible) {
				reveal = 0
				root.opacity = 0
				root.hidden = true
				return
			}
			root.hidden = false
			render()
			const targetReveal = 1
			const blend = 1 - Math.exp(-14 * k.dt())
			reveal = k.lerp(reveal, targetReveal, blend)
			if (Math.abs(reveal - targetReveal) < 0.005) reveal = targetReveal
			const eased = 1 - Math.pow(1 - reveal, 3)
			root.pos = target.pos.add(offset).add(0, (1 - eased) * 9)
			root.opacity = eased
			root.scale = k.vec2(k.lerp(PROMPT_SCALE * 0.9, PROMPT_SCALE, eased))
		},
	}
}
