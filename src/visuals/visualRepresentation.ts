export interface VisualPart {
	sprite: string
	offset?: readonly [number, number]
	scale?: number
}

export interface VisualRepresentation {
	parts: readonly VisualPart[]
	worldScale: number
	worldScaleY?: number
	facingOffset?: number
	uiScale?: number
}

export function scaleVisualRepresentation(
	visual: VisualRepresentation,
	multiplier: number
): VisualRepresentation {
	return {
		...visual,
		worldScale: visual.worldScale * multiplier,
		worldScaleY: visual.worldScaleY === undefined
			? undefined
			: visual.worldScaleY * multiplier,
	}
}

export function getPrimaryVisualSprite(visual: VisualRepresentation) {
	return visual.parts[0]?.sprite
}

export function requirePrimaryVisualSprite(visual: VisualRepresentation) {
	const sprite = getPrimaryVisualSprite(visual)
	if (!sprite) throw new Error("Visual representation has no primary sprite")
	return sprite
}
