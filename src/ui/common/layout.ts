import { k } from "../../main"

export const UI_MARGIN = 16

export function compactUi() {
	return k.width() < 640 || k.height() < 560
}

export function fitUiWidth(preferred: number, margin = UI_MARGIN) {
	return Math.min(preferred, k.width() - margin * 2)
}

export function fitUiHeight(preferred: number, margin = UI_MARGIN) {
	return Math.min(preferred, k.height() - margin * 2)
}

