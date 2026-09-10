import type { Cursor, GameObj, KAPLAYCtx } from "kaplay"
import { tags } from "../../tags"
import {
	acquireInteractionPromptSuppression,
} from "../ui/interactionPromptVisibilityService"

interface HiddenUiState {
	object: GameObj
	wasHidden: boolean
}

const CINEMATIC_UI_TAGS = [
	tags.gameLoopUi,
	tags.damageNumber,
	"debug",
] as const

let kaplayContext: KAPLAYCtx | undefined
let cinematicModeEnabled = false
let previousCursor: Cursor = "default"
let releaseInteractionPromptSuppression: (() => void) | undefined
const hiddenUiStates = new Map<number, HiddenUiState>()

export function installCinematicModeService(k: KAPLAYCtx) {
	if (kaplayContext) return
	kaplayContext = k
	k.onUpdate(syncCinematicPresentation)
}

export function setCinematicModeEnabled(enabled: boolean) {
	if (!kaplayContext || enabled === cinematicModeEnabled) return

	cinematicModeEnabled = enabled
	if (enabled) {
		previousCursor = kaplayContext.getCursor()
		releaseInteractionPromptSuppression =
			acquireInteractionPromptSuppression()
		syncCinematicPresentation()
		return
	}

	releaseInteractionPromptSuppression?.()
	releaseInteractionPromptSuppression = undefined
	for (const state of hiddenUiStates.values()) {
		if (state.object.exists()) state.object.hidden = state.wasHidden
	}
	hiddenUiStates.clear()
	kaplayContext.setCursor(previousCursor)
}

export function cinematicModeIsEnabled() {
	return cinematicModeEnabled
}

function syncCinematicPresentation() {
	if (!kaplayContext || !cinematicModeEnabled) return

	for (const tag of CINEMATIC_UI_TAGS) {
		for (const object of kaplayContext.get<GameObj>(tag)) {
			const state = hiddenUiStates.get(object.id)
			if (!state) {
				hiddenUiStates.set(object.id, {
					object,
					wasHidden: object.hidden,
				})
			} else if (!object.hidden) {
				state.wasHidden = false
			}
			object.hidden = true
		}
	}

	for (const [id, state] of hiddenUiStates) {
		if (!state.object.exists()) hiddenUiStates.delete(id)
	}
	kaplayContext.setCursor("none")
}
