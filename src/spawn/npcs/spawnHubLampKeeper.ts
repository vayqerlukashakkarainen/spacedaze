import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { snareable } from "../../comp/snareable"
import { k, layers, WORLD_CAMERA_SCALE } from "../../main"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { playCutscene, type CutsceneDefinition } from "../../services/narrative/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getHubLevel } from "../../services/hub/hubProgressService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { showPopover } from "../../services/ui/popoverService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"
import {
	getHubRestorationLampPosition,
	HUB_RESTORATION_LAMP_COUNT,
} from "../spawnHubRestoration"

const INTERACT_RADIUS = 86
const LAMP_KEEPER_OFFSET_X = -112
const LAMP_KEEPER_OFFSET_Y = -112

export function spawnHubLampKeeper(ringCenter: ReturnType<typeof k.vec2>) {
	const startPos = ringCenter.add(
		LAMP_KEEPER_OFFSET_X,
		LAMP_KEEPER_OFFSET_Y
	)
	let talking = false
	const keeper = k.add([
		k.pos(startPos),
		k.sprite("hub_droid_lamp_keeper", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(135),
		k.scale(0.95),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 0.8,
			radius: 10,
			releaseDrag: 2.8,
			returnAfterRelease: true,
			returnSpeed: 95,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: keeper,
		offset: k.vec2(0, -48),
		label: { text: "LAMP KEEPER" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"lamp-keeper",
		startConversation
	)
	keeper.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: keeper,
		npcId: "lamp-keeper",
		getDialogueId: () => getLampDialogue().id,
		isVisible: () => !talking && !keeper.isInRange,
		offset: k.vec2(0, -48),
	})

	registerBatchedEntityUpdate("world", keeper, () => {
		prompt.update(!talking && keeper.isInRange)
	})

	function startConversation() {
		if (talking || !keeper.exists()) return false
		const dialogue = getLampDialogue()
		const litLampCount = Math.min(
			HUB_RESTORATION_LAMP_COUNT,
			getHubLevel()
		)
		talking = true
		keeper.isInRange = false
		prompt.update(false)
		void playCutscene(createLampKeeperConversation(
			dialogue,
			ringCenter,
			litLampCount
		), {
			resolveActor: (id) => {
				if (id === "lampKeeper") return keeper
				if (id === "player") return k.get(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result === "completed") {
				markNpcDialogueSeen("lamp-keeper", dialogue.id)
				showDroidDiscovery()
			}
		}).finally(() => {
			if (keeper.exists()) talking = false
		})
		return true
	}

	function showDroidDiscovery() {
		if (!discoverDroid("lamp-keeper")) return
		const definition = getDroidDefinition("lamp-keeper")
		if (!definition) return
		showPopover({
			title: "DROID DISCOVERED",
			message: definition.name,
			description: "NEW DROID RECORD ADDED TO THE COMPENDIUM",
			sprite: definition.sprite,
			color: k.rgb(0, 220, 255),
			duration: 6,
		})
	}

	return keeper
}

function createLampKeeperConversation(
	dialogueContent: ReturnType<typeof dialogue.lampKeeper>,
	ringCenter: ReturnType<typeof k.vec2>,
	litLampCount: number
): CutsceneDefinition {
	const emotion = dialogueContent.id === "all-lamps-lit" ? "impressed" : "idea"
	const recentLampPosition = getHubRestorationLampPosition(
		ringCenter,
		litLampCount
	)
	return {
		id: "hub-lamp-keeper-conversation",
		speakerActors: { "LAMP KEEPER": "lampKeeper" },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "rotate",
				actor: "lampKeeper",
				target: recentLampPosition,
				duration: 0.24,
				easing: "easeInOutCubic",
			},
			{
				type: "camera",
				target: recentLampPosition,
				zoom: WORLD_CAMERA_SCALE * 2,
				duration: 0.45,
				easing: "easeOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogueContent.observation,
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "lampKeeper",
						zoom: WORLD_CAMERA_SCALE * 2,
						duration: 0.4,
						easing: "easeInOutCubic",
					},
					{
						type: "rotate",
						actor: "lampKeeper",
						target: "player",
						duration: 0.3,
						easing: "easeInOutCubic",
					},
				],
			},
			{
				type: "emotion",
				actor: "lampKeeper",
				emotion,
				options: {
					duration: 2.2,
					priority: "narrative",
					sound: {
						id: "ui_hover",
						volume: 0.3,
						speed: emotion === "impressed" ? 1.16 : 1.06,
					},
				},
			},
			{ type: "wait", duration: emotion === "impressed" ? 0.48 : 0.34 },
			{
				type: "dialogue",
				lines: dialogueContent.explanation,
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

function getLampDialogue() {
	const litLamps = Math.min(HUB_RESTORATION_LAMP_COUNT, getHubLevel())
	return dialogue.lampKeeper(litLamps, HUB_RESTORATION_LAMP_COUNT)
}
