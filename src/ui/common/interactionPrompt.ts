import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { createUiSurface } from "./surface"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES } from "./theme"
import {
	interactionPromptsSuppressed,
	registerInteractionPromptHide,
} from "../../services/interactionPromptVisibilityService"
import type { InteractableComp } from "../../comp/interactable"
import {
	formatInputBindingCompact,
	getInputBinding,
} from "../../services/inputBindingService"

export interface InteractionPromptContent {
	title: string
	action: string
	detailLeft?: string
	detailRight?: string
	requirementsMet?: boolean
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
	compact?: boolean
}

const DEFAULT_PROMPT_WIDTH = 220
const MIN_PROMPT_HEIGHT = 76
const PROMPT_SCALE = 0.8

export function createInteractionPrompt({
	target,
	offset,
	content,
	width = DEFAULT_PROMPT_WIDTH,
	compact = false,
}: InteractionPromptOptions) {
	let reveal = 0
	let renderedContent = ""
	let promptWidth = width
	let promptHeight = compact ? 42 : MIN_PROMPT_HEIGHT
	const root = k.add([
		k.pos(target.pos.add(offset)),
		k.scale(PROMPT_SCALE * 0.9),
		k.opacity(0),
		k.layer(layers.gameText),
		k.z(200),
		tags.gameLoop,
	])
	root.hidden = true
	const hidePrompt = () => {
		reveal = 0
		root.opacity = 0
		root.hidden = true
	}
	const unregisterPromptHide = registerInteractionPromptHide(hidePrompt)
	root.onDestroy(unregisterPromptHide)
	const surface = createUiSurface(root, {
		pos: k.vec2(0, 0),
		size: k.vec2(promptWidth, promptHeight),
		anchor: "center",
		borderColor: UI_COLORS.accent,
		opacity: 0.97,
	})
	const title = addThemedText(root, {
		text: "",
		pos: k.vec2(-promptWidth / 2 + 10, -promptHeight / 2 + 8),
		variant: "eyebrow",
		size: UI_FONT_SIZES.micro,
		width: promptWidth - 20,
		color: k.rgb(...UI_COLORS.text),
	})
	const notification = addThemedText(root, {
		text: "!",
		pos: k.vec2(promptWidth / 2 - 10, -promptHeight / 2 + 8),
		variant: "eyebrow",
		size: UI_FONT_SIZES.micro,
		align: "right",
		color: k.rgb(...UI_COLORS.warning),
	})
	notification.hidden = true
	const action = addThemedText(root, {
		text: "",
		pos: k.vec2(-promptWidth / 2 + 10, -12),
		variant: "title",
		width: promptWidth - 58,
	})
	const inputPrompt = addThemedText(root, {
		text: formatInputBindingCompact(getInputBinding("interact")),
		pos: k.vec2(promptWidth / 2 - 28, -12),
		variant: "title",
		width: 20,
		align: "center",
		color: k.rgb(...UI_COLORS.text),
	})
	const separators = [55, 59].map((offsetY) =>
		root.add([
			k.rect(promptWidth - 20, 2),
			k.pos(-width / 2 + 10, -promptHeight / 2 + offsetY),
			k.color(...UI_COLORS.border),
		])
	)
	if (compact) {
		title.hidden = true
		notification.hidden = true
		for (const separator of separators) separator.hidden = true
	}
	const detailLeft = addThemedText(root, {
		text: "",
		pos: k.vec2(-promptWidth / 2 + 10, -promptHeight / 2 + 66),
		variant: "muted",
		size: UI_FONT_SIZES.micro,
		width: promptWidth - 20,
	})
	const detailRight = addThemedText(root, {
		text: "",
		pos: k.vec2(-promptWidth / 2 + 10, -promptHeight / 2 + 66),
		variant: "caption",
		size: UI_FONT_SIZES.micro,
		width: promptWidth - 20,
		align: "right",
	})
	if (compact) {
		detailLeft.hidden = true
		detailRight.hidden = true
	}

	function resolveContent() {
		return typeof content === "function" ? content() : content
	}

	function render() {
		const next = resolveContent()
		const interactionBinding = formatInputBindingCompact(
			getInputBinding("interact")
		)
		const signature = JSON.stringify([next, interactionBinding])
		if (signature === renderedContent) return
		renderedContent = signature
		const titleText = next.title.toUpperCase()
		const actionText = next.action.toUpperCase()
		const detailLeftText = (next.detailLeft ?? "").toUpperCase()
		const detailRightText = (next.detailRight ?? "").toUpperCase()
		const detailContentWidth = detailLeftText && detailRightText
			? measureTextWidth(detailLeftText, UI_FONT_SIZES.micro) +
				measureTextWidth(detailRightText, UI_FONT_SIZES.micro) + 28
			: Math.max(
				measureTextWidth(detailLeftText, UI_FONT_SIZES.micro),
				measureTextWidth(detailRightText, UI_FONT_SIZES.micro)
			) + 20
		promptWidth = Math.ceil(Math.max(
			width,
			measureTextWidth(titleText, UI_FONT_SIZES.micro) + 20,
			measureTextWidth(actionText, UI_FONT_SIZES.body) + 58,
			detailContentWidth
		))
		surface.width = promptWidth
		title.width = promptWidth - 20
		action.width = promptWidth - 58
		detailLeft.width = promptWidth - 20
		detailRight.width = promptWidth - 20
		title.text = titleText
		action.text = actionText
		detailLeft.text = detailLeftText
		detailRight.text = detailRightText
		inputPrompt.text = interactionBinding
		const requirementColor = next.requirementsMet === undefined
			? undefined
			: next.requirementsMet ? UI_COLORS.accent : UI_COLORS.danger
		detailLeft.color = k.rgb(...(requirementColor ?? UI_COLORS.muted))
		detailRight.color = k.rgb(...(requirementColor ?? UI_COLORS.accent))
		promptHeight = compact
			? 42
			: Math.ceil(Math.max(
				MIN_PROMPT_HEIGHT,
				68,
				74 + detailLeft.formattedText().height,
				74 + detailRight.formattedText().height
			))
		surface.height = promptHeight
		const promptTop = -promptHeight / 2
		if (compact) {
			action.pos = k.vec2(
				-promptWidth / 2 + 10,
				-action.formattedText().height / 2
			)
			inputPrompt.pos = k.vec2(promptWidth / 2 - 30, -6)
			notification.hidden = true
			return
		}
		title.pos = k.vec2(-promptWidth / 2 + 10, promptTop + 8)
		notification.pos = k.vec2(promptWidth / 2 - 10, promptTop + 8)
		action.pos = k.vec2(-promptWidth / 2 + 10, promptTop + 26)
		inputPrompt.pos = k.vec2(promptWidth / 2 - 30, promptTop + 26)
		for (let index = 0; index < separators.length; index++) {
			const separator = separators[index]
			separator.pos = k.vec2(
				-promptWidth / 2 + 10,
				promptTop + 55 + index * 4
			)
			separator.width = promptWidth - 20
		}
		detailLeft.pos = k.vec2(-promptWidth / 2 + 10, promptTop + 66)
		detailRight.pos = k.vec2(-promptWidth / 2 + 10, promptTop + 66)
		notification.hidden = !next.notification
	}

	function measureTextWidth(text: string, size: number) {
		if (!text) return 0
		return k.formatText({
			text,
			font: "unscii",
			size,
		}).width
	}

	target.onDestroy(() => {
		if (root.exists()) k.destroy(root)
	})

	return {
		update(visible: boolean) {
			if (!root.exists() || !target.exists()) return
			const interactable = target as GameObj<InteractableComp>
			if (
				!visible ||
				!interactable.isInteractionTarget ||
				interactionPromptsSuppressed()
			) {
				hidePrompt()
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
