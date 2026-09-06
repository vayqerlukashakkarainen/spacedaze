import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k } from "../main"
import { registerBatchedEntityUpdate } from "./entityUpdateService"
import {
	actorEmotion,
	showEmotion,
	type EmotionHandle,
} from "./emotionService"
import { hasSeenNpcDialogue } from "./npcDialogueService"

export interface NpcDialogueIndicatorOptions {
	actor: GameObj<PosComp>
	npcId: string
	getDialogueId: () => string | undefined
	isVisible?: () => boolean
	offset?: Vec2
}

export function registerNpcDialogueIndicator(
	options: NpcDialogueIndicatorOptions
) {
	let indicator: EmotionHandle | undefined
	const unregister = registerBatchedEntityUpdate(
		"world",
		options.actor,
		syncIndicator
	)
	const destroyController = options.actor.onDestroy(() => {
		unregister()
		indicator?.cancel()
		indicator = undefined
	})
	syncIndicator()

	return () => {
		unregister()
		destroyController.cancel()
		indicator?.cancel()
		indicator = undefined
	}

	function syncIndicator() {
		if (!options.actor.exists()) return
		const dialogueId = options.getDialogueId()
		const shouldShow = dialogueId !== undefined &&
			(options.isVisible?.() ?? true) &&
			!hasSeenNpcDialogue(options.npcId, dialogueId)
		const currentEmotion = actorEmotion(options.actor)
		if (!shouldShow) {
			if (currentEmotion === "dialogue") indicator?.cancel()
			indicator = undefined
			return
		}
		if (currentEmotion !== undefined) return
		const nextIndicator = showEmotion(options.actor, "dialogue", {
			duration: Number.POSITIVE_INFINITY,
			priority: "ambient",
			offset: options.offset ?? k.vec2(0, -48),
			bobAmount: 1.5,
		})
		if (!nextIndicator) return
		indicator = nextIndicator
		void nextIndicator.completed.then(() => {
			if (indicator === nextIndicator) indicator = undefined
		})
	}
}
