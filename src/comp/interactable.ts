import type { Comp, GameObj, PosComp, Vec2 } from "kaplay"

export interface InteractableComp extends Comp {
	interactRadius: number
	interactionPriority: number
	onInteract: () => void
	isInRange: boolean
	isInteractionTarget: boolean
	setInteractRadius(radius: number): void
	setInteractionPriority(priority: number): void
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
		isInteractionTarget: false,

		setInteractRadius(newRadius: number) {
			this.interactRadius = newRadius
		},

		setInteractionPriority(newPriority: number) {
			this.interactionPriority = newPriority
		},

		setOnInteract(newCallback: () => void) {
			this.onInteract = newCallback
		},
	}
}

type InteractableObject = GameObj<InteractableComp | PosComp>

let priorityInteraction: InteractableObject | undefined

export function updatePriorityInteraction(
	objects: readonly GameObj[],
	playerPos: Vec2
) {
	let closestInteractable: InteractableObject | undefined
	let closestDistance = Infinity
	let highestPriority = -Infinity

	for (const obj of objects) {
		const interactable = obj as InteractableObject
		interactable.isInteractionTarget = false
		if (!interactable.pos) {
			interactable.isInRange = false
			continue
		}

		const distance = interactable.pos.dist(playerPos)
		interactable.isInRange = distance < interactable.interactRadius
		if (!interactable.isInRange) continue

		const priority = interactable.interactionPriority
		if (priority < highestPriority) continue
		if (priority > highestPriority) closestDistance = Infinity
		if (distance >= closestDistance) continue

		closestInteractable = interactable
		closestDistance = distance
		highestPriority = priority
	}

	priorityInteraction = closestInteractable
	if (priorityInteraction) priorityInteraction.isInteractionTarget = true
}

export function getPriorityInteraction() {
	if (
		!priorityInteraction?.exists() ||
		!priorityInteraction.isInteractionTarget
	) return undefined
	return priorityInteraction
}

export const INTERACTION_PRIORITY = {
	dialogue: 0,
	default: 1,
	progressionDialogue: 2,
} as const
