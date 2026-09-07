import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { k, layers, WORLD_CAMERA_SCALE } from "../../main"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { playCutscene, type CutsceneDefinition } from "../../services/cutsceneService"
import type { DialogueLine } from "../../services/dialogService"
import type { EmotionId } from "../../services/emotionService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getHubLevel } from "../../services/hubProgressService"
import {
	getNextNpcDialogue,
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
	type NpcDialogueVariant,
} from "../../services/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/npcDialogueIndicatorService"
import { showPopover } from "../../services/popoverService"
import { spawnBasicBlaster } from "../../services/projectileHelpers"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"

const INTERACT_RADIUS = 86
const CONVERSATION_ZOOM_MULTIPLIER = 1.25
const DIALOGUES: readonly NpcDialogueVariant[] = [
	{
		id: "forge-calibration",
		minHubLevel: 3,
		lines: [
			{
				speaker: "RANGE KEEPER",
				text: "The salvage forge is operational. At last, a machine here understands precision.",
			},
			{
				speaker: "RANGE KEEPER",
				text: "I submitted the asteroid as calibration material. The forge rejected it as infrastructure.",
			},
		],
	},
	{
		id: "range-expansion",
		minHubLevel: 5,
		lines: [
			{
				speaker: "RANGE KEEPER",
				text: "The expanded range provides seventeen new firing angles.",
			},
			{
				speaker: "RANGE KEEPER",
				text: "The asteroid has responded by remaining exactly where it was. Provocative.",
			},
		],
	},
	{
		id: "restoration-complete",
		minHubLevel: 8,
		lines: [
			{
				speaker: "RANGE KEEPER",
				text: "The station is restored. Every system reports nominal operation.",
			},
			{
				speaker: "RANGE KEEPER",
				text: "The asteroid remains. I have filed this as a personal disagreement.",
			},
		],
	},
]

export function spawnHubRingWatcher(trainingTarget: ReturnType<typeof k.vec2>) {
	if (getHubLevel() < 2) return
	const startPos = trainingTarget.add(126, 36)
	const facingDirection = trainingTarget.sub(startPos).unit()
	let talking = false
	let shotTimer = k.rand(2.5, 5.5)
	const watcher = k.add([
		k.pos(startPos),
		k.sprite("hub_ship_range_keeper", { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(facingDirection.angle() + 90),
		k.scale(0.86),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		tags.props,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: watcher,
		offset: k.vec2(0, -52),
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"ring-watcher",
		startConversation
	)
	watcher.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: watcher,
		npcId: "ring-watcher",
		getDialogueId: () => getNextNpcDialogue(
			"ring-watcher",
			DIALOGUES
		)?.id,
		isVisible: () => !talking && !watcher.isInRange,
		offset: k.vec2(0, -52),
	})

	registerBatchedEntityUpdate("world", watcher, () => {
		prompt.update(!talking && watcher.isInRange)
		if (talking) return
		shotTimer -= k.dt()
		if (shotTimer > 0) return
		shotTimer = k.rand(4.5, 8.5)
		fireCalibrationShot(watcher.pos, trainingTarget)
	})

	function startConversation() {
		if (talking || !watcher.exists()) return false
		const dialogue = getNextNpcDialogue("ring-watcher", DIALOGUES)
		if (!dialogue) return false
		talking = true
		watcher.isInRange = false
		prompt.update(false)
		if (discoverDroid("ring-watcher")) {
			const definition = getDroidDefinition("ring-watcher")
			if (definition) {
				showPopover({
					title: "DROID DISCOVERED",
					message: definition.name,
					description: "NEW DROID RECORD ADDED TO THE PHASE STATION",
					sprite: definition.sprite,
					color: k.rgb(0, 220, 255),
					duration: 6,
				})
			}
		}
		void playCutscene(createRingWatcherConversation(dialogue.id, dialogue.lines), {
			resolveActor: (id) => {
				if (id === "ringWatcher") return watcher
				if (id === "player") return k.get(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result === "completed") {
				markNpcDialogueSeen("ring-watcher", dialogue.id)
			}
		}).finally(() => {
			if (watcher.exists()) talking = false
		})
		return true
	}

	return watcher
}

function createRingWatcherConversation(
	dialogueId: string,
	lines: readonly DialogueLine[]
): CutsceneDefinition {
	const reaction = ringWatcherReaction(dialogueId)
	const reactionIndex = Math.max(1, lines.length - 1)
	return {
		id: "hub-ring-watcher-conversation",
		speakerActors: { "RANGE KEEPER": "ringWatcher" },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "ringWatcher",
						zoom: WORLD_CAMERA_SCALE * CONVERSATION_ZOOM_MULTIPLIER,
						duration: 0.4,
						easing: "easeOutCubic",
					},
					{
						type: "rotate",
						actor: "ringWatcher",
						target: "player",
						duration: 0.3,
						easing: "easeInOutCubic",
					},
				],
			},
			{
				type: "dialogue",
				lines: lines.slice(0, reactionIndex),
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			{
				type: "emotion",
				actor: "ringWatcher",
				emotion: reaction,
				options: {
					duration: 2.2,
					priority: "narrative",
					sound: {
						id: "ui_hover",
						volume: 0.34,
						speed: reaction === "angry" ? 0.92 : 1.12,
					},
				},
			},
			{ type: "wait", duration: 0.5 },
			{
				type: "dialogue",
				lines: lines.slice(reactionIndex),
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			{
				type: "restoreCamera",
				duration: 0.28,
				easing: "easeInOutCubic",
			},
		],
	}
}

function ringWatcherReaction(dialogueId: string): EmotionId {
	switch (dialogueId) {
		case "forge-calibration":
			return "happy"
		case "range-expansion":
			return "impressed"
		case "restoration-complete":
			return "happy"
		default:
			return "question"
	}
}

function fireCalibrationShot(
	startPos: ReturnType<typeof k.vec2>,
	trainingTarget: ReturnType<typeof k.vec2>
) {
	const direction = trainingTarget.sub(startPos).unit()
	return spawnBasicBlaster(
		startPos.add(direction.scale(15)),
		direction,
		direction.angle() + 90,
		2,
		0.55,
		[tags.friendly, tags.blaster],
		false
	)
}
