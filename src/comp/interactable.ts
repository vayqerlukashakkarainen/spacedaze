import { Comp, GameObj } from "kaplay"

export interface InteractableComp extends Comp {
	interactRadius: number
	interactionPriority: number
	onInteract: () => void
	isInRange: boolean
	setInteractRadius(radius: number): void
	setOnInteract(callback: () => void): void
}

export function interactable(
	radius: number,
	callback: () => void,
	priority = INTERACTION_PRIORITY.default
): InteractableComp {
	return {
		id: "interactable",
		interactRadius: radius,
		interactionPriority: priority,
		onInteract: callback,
		isInRange: false,

		setInteractRadius(newRadius: number) {
			this.interactRadius = newRadius
		},

		setOnInteract(newCallback: () => void) {
			this.onInteract = newCallback
		},
	}
}

export const INTERACTION_PRIORITY = {
	dialogue: 0,
	default: 1,
} as const
