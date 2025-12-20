import { Comp, GameObj } from "kaplay"

export interface InteractableComp extends Comp {
	interactRadius: number
	onInteract: () => void
	isInRange: boolean
	setInteractRadius(radius: number): void
	setOnInteract(callback: () => void): void
}

export function interactable(
	radius: number,
	callback: () => void
): InteractableComp {
	return {
		id: "interactable",
		interactRadius: radius,
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
