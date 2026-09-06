import { interactable } from "../../comp/interactable"
import { k, layers } from "../../main"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { getEffectiveUpgradeLevel } from "../../upg"
import { playCutscene, type CutsceneDefinition } from "../../services/cutsceneService"
import type { DialogueLine } from "../../services/dialogService"
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
import { createInteractionPrompt } from "../../ui/common"

const INTERACT_RADIUS = 86
const DIALOGUES: readonly NpcDialogueVariant[] = [
	{
		id: "targeting-computer",
		minHubLevel: 2,
		lines: [
			{
				speaker: "RANGE KEEPER",
				text: "They call this training asteroid indestructible. An embarrassing exaggeration.",
			},
			{
				speaker: "RANGE KEEPER",
				text: [
					{ text: "I believe I have located the " },
					{
						text: "TARGETING COMPUTER",
						reference: { kind: "reward", id: "mouseAim" },
					},
					{ text: "." },
				],
			},
			{
				speaker: "RANGE KEEPER",
				text: "Once that legendary system is mine, this rock will survive approximately six seconds.",
			},
		],
	},
	{
		id: "targeting-computer-envy",
		minHubLevel: 2,
		isAvailable: () => getEffectiveUpgradeLevel("mouseAim") !== undefined,
		lines: [
			{
				speaker: "RANGE KEEPER",
				text: [
					{ text: "That is the " },
					{
						text: "TARGETING COMPUTER",
						reference: { kind: "reward", id: "mouseAim" },
					},
					{ text: ", isn't it?" },
				],
			},
			{
				speaker: "RANGE KEEPER",
				text: "You barely aim, and it follows your cursor for you. I have spent years calibrating manually.",
			},
			{
				speaker: "RANGE KEEPER",
				text: "I am not jealous. I am documenting an obvious allocation error.",
			},
		],
	},
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
		k.sprite("enemy_sniper"),
		k.anchor("center"),
		k.rotate(facingDirection.angle() + 90),
		k.scale(0.86),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(INTERACT_RADIUS, startConversation),
		tags.props,
		tags.gameLoop,
	])
	const prompt = createInteractionPrompt({
		target: watcher,
		offset: k.vec2(0, -52),
		width: 116,
		compact: true,
		content: {
			title: "",
			action: "TALK",
		},
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
		isVisible: () => !talking,
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
		void playCutscene(createRingWatcherConversation(dialogue.lines), {
			resolveActor: (id) => id === "ringWatcher" ? watcher : undefined,
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

function createRingWatcherConversation(lines: readonly DialogueLine[]): CutsceneDefinition {
	return {
		id: "hub-ring-watcher-conversation",
		pauseGameplay: false,
		pauseVisualEffects: false,
		steps: [
			{
				type: "emotion",
				actor: "ringWatcher",
				emotion: "question",
				options: {
					duration: 3.2,
					priority: "narrative",
					sound: { id: "ui_hover", volume: 0.32, speed: 0.9 },
				},
			},
			{
				type: "dialogue",
				lines,
				options: {
					gameplay: "live",
					advance: "manual",
					input: "passthrough",
					overlayOpacity: 0,
				},
			},
			{
				type: "emotion",
				actor: "ringWatcher",
				emotion: "idea",
				options: {
					duration: 2.8,
					priority: "narrative",
					sound: { id: "ui_hover", volume: 0.34, speed: 1.08 },
				},
			},
		],
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
