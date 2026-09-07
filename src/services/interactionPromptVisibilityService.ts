type InteractionPromptHide = () => void

const suppressors = new Set<symbol>()
const hideCallbacks = new Set<InteractionPromptHide>()

export function interactionPromptsSuppressed() {
	return suppressors.size > 0
}

export function acquireInteractionPromptSuppression() {
	const token = Symbol("interaction-prompt-suppression")
	suppressors.add(token)
	for (const hide of hideCallbacks) hide()
	let released = false
	return () => {
		if (released) return
		released = true
		suppressors.delete(token)
	}
}

export function registerInteractionPromptHide(hide: InteractionPromptHide) {
	hideCallbacks.add(hide)
	if (interactionPromptsSuppressed()) hide()
	return () => hideCallbacks.delete(hide)
}
