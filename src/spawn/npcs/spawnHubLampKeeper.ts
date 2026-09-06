import { interactable } from "../../comp/interactable"
import { k, layers, WORLD_CAMERA_SCALE } from "../../main"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { playCutscene, type CutsceneDefinition } from "../../services/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { getHubLevel } from "../../services/hubProgressService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
	type NpcDialogueVariant,
} from "../../services/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/npcDialogueIndicatorService"
import { showPopover } from "../../services/popoverService"
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
		k.sprite("drone_salvager"),
		k.anchor("center"),
		k.rotate(135),
		k.scale(0.95),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(INTERACT_RADIUS, startConversation),
		tags.props,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: keeper,
		offset: k.vec2(0, -48),
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
		if (discoverDroid("lamp-keeper")) {
			const definition = getDroidDefinition("lamp-keeper")
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
			}
		}).finally(() => {
			if (keeper.exists()) talking = false
		})
		return true
	}

	return keeper
}

function createLampKeeperConversation(
	dialogue: NpcDialogueVariant,
	ringCenter: ReturnType<typeof k.vec2>,
	litLampCount: number
): CutsceneDefinition {
	const emotion = dialogue.id === "all-lamps-lit" ? "impressed" : "idea"
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
				lines: dialogue.lines.slice(0, 1),
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
				lines: dialogue.lines.slice(1),
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

function getLampDialogue(): NpcDialogueVariant {
	const litLamps = Math.min(HUB_RESTORATION_LAMP_COUNT, getHubLevel())
	if (litLamps >= HUB_RESTORATION_LAMP_COUNT) {
		return {
			id: "all-lamps-lit",
			lines: [
				{
					speaker: "LAMP KEEPER",
					text: "All eight are burning. I had forgotten how bright home could be.",
				},
				{
					speaker: "LAMP KEEPER",
					text: "The phase crown is awake. The hub can guide lost ships home again.",
				},
			],
		}
	}
	return {
		id: `hub-level-${litLamps}`,
		lines: [
			{
				speaker: "LAMP KEEPER",
				text: `${litLamps} of ${HUB_RESTORATION_LAMP_COUNT} lamps are lit. Each one marks a piece of the hub we have reclaimed.`,
			},
			{
				speaker: "LAMP KEEPER",
				text: "They are not decoration. Light means another part of this station is stable enough to live in again.",
			},
			{
				speaker: "LAMP KEEPER",
				text: "When all eight are lit, the phase crown will wake. The hub will be able to guide lost ships home again.",
			},
		],
	}
}
