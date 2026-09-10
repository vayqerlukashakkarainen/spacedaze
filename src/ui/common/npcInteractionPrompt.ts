import type { Color, GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import type { InteractableComp } from "../../comp/interactable"
import {
	interactionPromptsSuppressed,
	registerInteractionPromptHide,
} from "../../services/ui/interactionPromptVisibilityService"
import {
	formatInputBindingCompact,
	getInputBinding,
	type InputActionId,
} from "../../services/input/inputBindingService"

interface InteractionBubbleLabel {
	text: string
	color?: Color
}

type InteractionBubbleLabelSource =
	| InteractionBubbleLabel
	| (() => InteractionBubbleLabel)

type InteractionBubbleVisibilitySource = boolean | (() => boolean)

interface NpcInteractionPromptOptions {
	target: GameObj
	offset: Vec2
	label: InteractionBubbleLabelSource
	inputAction?: InputActionId
	requireInteractionTarget?: boolean
	showKey?: InteractionBubbleVisibilitySource
}

export interface NpcInteractionPromptHandle {
	update(visible: boolean): void
}

export interface NpcInteractionPromptPool {
	createPrompt(options: {
		target: GameObj
		offset: Vec2
		label: InteractionBubbleLabelSource
	}): NpcInteractionPromptHandle
	destroy(): void
}

const PROMPT_SCREEN_SIZE = 32
const KEY_OFFSET_Y = -2
const ENTER_RESPONSE = 9
const EXIT_RESPONSE = 9
const ENTER_SLIDE = 6

export function createNpcInteractionPromptPool(
	size = 2
): NpcInteractionPromptPool {
	interface PromptBinding {
		target: GameObj
		offset: Vec2
		label: InteractionBubbleLabelSource
		destroyed: boolean
	}
	interface PromptSlot {
		root: GameObj
		bubble: GameObj
		key: GameObj
		labelText: GameObj
		binding: PromptBinding | undefined
		reveal: number
		requestedVisible: boolean
	}

	const slots: PromptSlot[] = []
	let activeBinding: PromptBinding | undefined
	let activeSlotIndex = -1
	let destroyed = false

	for (let index = 0; index < Math.max(1, size); index++) {
		const root = k.add([
			k.pos(),
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
		const slot: PromptSlot = {
			root,
			bubble,
			key,
			labelText,
			binding: undefined,
			reveal: 0,
			requestedVisible: false,
		}
		const hidePrompt = () => hideSlot(slot)
		const unregisterPromptHide = registerInteractionPromptHide(hidePrompt)
		root.onDestroy(unregisterPromptHide)
		root.onUpdate(() => updateSlot(slot))
		slots.push(slot)
	}

	return {
		createPrompt(options) {
			const binding: PromptBinding = { ...options, destroyed: false }
			options.target.onDestroy(() => {
				binding.destroyed = true
				releaseBinding(binding)
			})
			return {
				update(visible) {
					if (destroyed || binding.destroyed) return
					const interactable = options.target as GameObj<InteractableComp>
					const requestedVisible = visible &&
						interactable.isInteractionTarget === true &&
						!interactionPromptsSuppressed()
					if (!requestedVisible) {
						releaseBinding(binding)
						return
					}
					activateBinding(binding)
				},
			}
		},
		destroy() {
			if (destroyed) return
			destroyed = true
			activeBinding = undefined
			for (const slot of slots) {
				if (slot.root.exists()) k.destroy(slot.root)
			}
		},
	}

	function activateBinding(binding: PromptBinding) {
		if (activeBinding !== binding) {
			if (activeSlotIndex >= 0) slots[activeSlotIndex].requestedVisible = false
			activeSlotIndex = (activeSlotIndex + 1) % slots.length
			activeBinding = binding
			slots[activeSlotIndex].binding = binding
		}
		const slot = slots[activeSlotIndex]
		slot.requestedVisible = true
		slot.root.hidden = false
	}

	function releaseBinding(binding: PromptBinding) {
		const slot = slots.find((candidate) => candidate.binding === binding)
		if (slot) slot.requestedVisible = false
		if (activeBinding === binding) activeBinding = undefined
	}

	function hideSlot(slot: PromptSlot) {
		slot.requestedVisible = false
		slot.reveal = 0
		slot.bubble.opacity = 0
		slot.key.opacity = 0
		slot.labelText.opacity = 0
		slot.root.hidden = true
	}

	function updateSlot(slot: PromptSlot) {
		const binding = slot.binding
		if (!binding || binding.destroyed || !binding.target.exists()) {
			slot.requestedVisible = false
		}
		if (!slot.requestedVisible && slot.reveal === 0) {
			hideSlot(slot)
			return
		}
		const targetReveal = slot.requestedVisible ? 1 : 0
		const blend = 1 - Math.exp(-(
			slot.requestedVisible ? ENTER_RESPONSE : EXIT_RESPONSE
		) * k.dt())
		slot.reveal = k.lerp(slot.reveal, targetReveal, blend)
		if (Math.abs(slot.reveal - targetReveal) < 0.005) {
			slot.reveal = targetReveal
		}
		if (slot.reveal === 0) {
			hideSlot(slot)
			return
		}
		if (!binding) return
		const eased = slot.reveal * slot.reveal * (3 - 2 * slot.reveal)
		const cameraScale = Math.max(0.001, k.getCamScale().x)
		slot.root.pos = binding.target.pos.add(k.vec2(
			binding.offset.x / cameraScale,
			(binding.offset.y + (1 - eased) * ENTER_SLIDE) / cameraScale
		))
		slot.root.scale = k.vec2(1 / cameraScale)
		slot.root.hidden = false
		slot.bubble.opacity = eased
		slot.key.text = formatInputBindingCompact(getInputBinding("interact"))
		slot.key.opacity = eased
		const nextLabel = typeof binding.label === "function"
			? binding.label()
			: binding.label
		slot.labelText.hidden = !nextLabel
		if (nextLabel) {
			slot.labelText.text = nextLabel.text.toUpperCase()
			slot.labelText.color = nextLabel.color ?? k.WHITE
			slot.labelText.opacity = eased
		}
	}
}

export function createNpcInteractionPrompt({
	target,
	offset,
	label,
	inputAction = "interact",
	requireInteractionTarget = true,
	showKey = true,
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
				(!requireInteractionTarget || interactable.isInteractionTarget) &&
				!interactionPromptsSuppressed()
			if (requestedVisible) root.hidden = false
		},
	}

	function animatePrompt() {
		key.text = formatInputBindingCompact(getInputBinding(inputAction))
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
		const keyVisible = typeof showKey === "function" ? showKey() : showKey
		const cameraScale = Math.max(0.001, k.getCamScale().x)
		root.pos = target.pos.add(k.vec2(
			offset.x / cameraScale,
			(offset.y + (1 - eased) * ENTER_SLIDE) / cameraScale
		))
		root.scale = k.vec2(1 / cameraScale)
		bubble.opacity = keyVisible ? eased : 0
		key.opacity = keyVisible ? eased : 0
		const nextLabel = typeof label === "function" ? label() : label
		labelText.hidden = !nextLabel
		if (nextLabel) {
			labelText.pos.y = keyVisible ? -24 : 0
			labelText.text = nextLabel.text.toUpperCase()
			labelText.color = nextLabel.color ?? k.WHITE
			labelText.opacity = eased
		} else {
			labelText.opacity = 0
		}
	}
}
