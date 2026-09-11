import type { Color, GameObj, PosComp, Vec2 } from "kaplay"
import { k } from "../../main"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import {
	actorEmotion,
	showEmotion,
	type EmotionHandle,
} from "./emotionService"
import { hasSeenNpcDialogue } from "./npcDialogueService"
import { registerHubCameraInterest } from "../hub/hubCameraInterestService"

export interface NpcDialogueIndicatorOptions {
	actor: GameObj<PosComp>
	npcId: string
	getDialogueId: () => string | undefined
	isVisible?: () => boolean
	offset?: Vec2
	color?: Color
	cameraInterest?: boolean
}

export function registerNpcDialogueIndicator(
	options: NpcDialogueIndicatorOptions
) {
	let indicator: EmotionHandle | undefined
	const hasUnseenDialogue = () => {
		const dialogueId = options.getDialogueId()
		return dialogueId !== undefined &&
			!hasSeenNpcDialogue(options.npcId, dialogueId)
	}
	const hasPendingDialogue = () =>
		hasUnseenDialogue() && (options.isVisible?.() ?? true)
	const unregisterCameraInterest = options.cameraInterest
		? registerHubCameraInterest(options.actor, {
			radius: 280,
			strength: 0.38,
			priority: 1.15,
			isActive: hasUnseenDialogue,
		})
		: undefined
	const unregister = registerBatchedEntityUpdate(
		"world",
		options.actor,
		syncIndicator
	)
	const destroyController = options.actor.onDestroy(() => {
		unregister()
		unregisterCameraInterest?.()
		indicator?.cancel()
		indicator = undefined
	})
	syncIndicator()

	return () => {
		unregister()
		unregisterCameraInterest?.()
		destroyController.cancel()
		indicator?.cancel()
		indicator = undefined
	}

	function syncIndicator() {
		if (!options.actor.exists()) return
		const shouldShow = hasPendingDialogue()
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
			screenSize: 32,
			offset: options.offset ?? k.vec2(0, -48),
			bobAmount: 1.5,
			color: options.color,
		})
		if (!nextIndicator) return
		indicator = nextIndicator
		void nextIndicator.completed.then(() => {
			if (indicator === nextIndicator) indicator = undefined
		})
	}
}
