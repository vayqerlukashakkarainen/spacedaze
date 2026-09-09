import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import type { InteractableComp } from "../../comp/interactable"
import {
	interactionPromptsSuppressed,
	registerInteractionPromptHide,
} from "../../services/interactionPromptVisibilityService"

interface InteractionBubbleLabel {
	text: string
	color?: Color
}

type InteractionBubbleLabelSource =
	| InteractionBubbleLabel
	| (() => InteractionBubbleLabel | undefined)

interface NpcInteractionPromptOptions {
	target: GameObj
	offset: Vec2
	label?: InteractionBubbleLabelSource
}

const PROMPT_SCREEN_SIZE = 32
const KEY_OFFSET_Y = -2
const ENTER_RESPONSE = 9
const EXIT_RESPONSE = 9
const ENTER_SLIDE = 6

export function createNpcInteractionPrompt({
	target,
	offset,
	label,
}: NpcInteractionPromptOptions) {
	let reveal = 0
	let requestedVisible = false
	const root = k.add([
		k.pos(target.pos),
		k.scale(1),
		k.layer(layers.gameText),
		k.z(5000),
	])
	root.hidden = true
	const bubble = root.add([
		k.sprite("emote_blank", {
			width: PROMPT_SCREEN_SIZE,
			height: PROMPT_SCREEN_SIZE,
		}),
		k.anchor("center"),
		k.opacity(0),
	])
	const key = root.add([
		k.text("F", { font: "unscii", size: 11 }),
		k.pos(0, KEY_OFFSET_Y),
		k.anchor("center"),
		k.color(k.BLACK),
		k.opacity(0),
	])
	const labelText = root.add([
		k.text("", { font: "unscii", size: 9 }),
		k.pos(0, -24),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
	])
	labelText.hidden = true
	const hidePrompt = () => {
		requestedVisible = false
		reveal = 0
		bubble.opacity = 0
		key.opacity = 0
		labelText.opacity = 0
		root.hidden = true
	}
	const unregisterPromptHide = registerInteractionPromptHide(hidePrompt)
	root.onDestroy(unregisterPromptHide)

	target.onDestroy(() => {
		if (root.exists()) k.destroy(root)
	})
	root.onUpdate(() => {
		if (!target.exists()) {
			k.destroy(root)
			return
		}
		animatePrompt()
	})

	return {
		update(visible: boolean) {
			const interactable = target as GameObj<InteractableComp>
			requestedVisible = visible &&
				interactable.isInteractionTarget &&
				!interactionPromptsSuppressed()
			if (requestedVisible) root.hidden = false
		},
	}

	function animatePrompt() {
		if (!requestedVisible && reveal === 0) {
			bubble.opacity = 0
			key.opacity = 0
			labelText.opacity = 0
			root.hidden = true
			return
		}
		root.hidden = false
		const targetReveal = requestedVisible ? 1 : 0
		const response = requestedVisible ? ENTER_RESPONSE : EXIT_RESPONSE
		const blend = 1 - Math.exp(-response * k.dt())
		reveal = k.lerp(reveal, targetReveal, blend)
		if (Math.abs(reveal - targetReveal) < 0.005) {
			reveal = targetReveal
		}
		if (reveal === 0) {
			bubble.opacity = 0
			key.opacity = 0
			labelText.opacity = 0
			root.hidden = true
			return
		}
		const eased = reveal * reveal * (3 - 2 * reveal)
		const cameraScale = Math.max(0.001, k.getCamScale().x)
		root.pos = target.pos.add(k.vec2(
			offset.x / cameraScale,
			(offset.y + (1 - eased) * ENTER_SLIDE) / cameraScale
		))
		root.scale = k.vec2(1 / cameraScale)
		bubble.opacity = eased
		key.opacity = eased
		const nextLabel = typeof label === "function" ? label() : label
		labelText.hidden = !nextLabel
		if (nextLabel) {
			labelText.text = nextLabel.text.toUpperCase()
			labelText.color = nextLabel.color ?? k.WHITE
			labelText.opacity = eased
		} else {
			labelText.opacity = 0
		}
	}
}
