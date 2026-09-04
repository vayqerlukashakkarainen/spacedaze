import type { Vec2 } from "kaplay"
import { createUiPointerRegion } from "../../services/uiPointerService"

export function uiHitRegion(size: Vec2, centered = false) {
	return createUiPointerRegion(size, centered)
}
