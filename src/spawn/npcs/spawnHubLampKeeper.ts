import { interactable } from "../../comp/interactable"
import { k, layers } from "../../main"
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
import { createInteractionPrompt } from "../../ui/common"

const INTERACT_RADIUS = 86
const LAMP_COUNT = 8
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
	const prompt = createInteractionPrompt({
		target: keeper,
		offset: k.vec2(0, -48),
		width: 116,
		compact: true,
		content: { title: "", action: "TALK" },
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
		isVisible: () => !talking,
		offset: k.vec2(0, -48),
	})

	registerBatchedEntityUpdate("world", keeper, () => {
		prompt.update(!talking && keeper.isInRange)
	})

	function startConversation() {
		if (talking || !keeper.exists()) return false
		const dialogue = getLampDialogue()
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
		void playCutscene(createLampKeeperConversation(dialogue), {
			resolveActor: (id) => id === "lampKeeper" ? keeper : undefined,
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
	dialogue: NpcDialogueVariant
): CutsceneDefinition {
	const emotion = dialogue.id === "all-lamps-lit" ? "impressed" : "idea"
	return {
		id: "hub-lamp-keeper-conversation",
		pauseGameplay: false,
		pauseVisualEffects: false,
		steps: [
			{
				type: "dialogue",
				lines: dialogue.lines.slice(0, 1),
				options: {
					gameplay: "live",
					advance: "manual",
					input: "passthrough",
					overlayOpacity: 0,
				},
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
					gameplay: "live",
					advance: "manual",
					input: "passthrough",
					overlayOpacity: 0,
				},
			},
		],
	}
}

function getLampDialogue(): NpcDialogueVariant {
	const litLamps = Math.min(LAMP_COUNT, getHubLevel())
	if (litLamps >= LAMP_COUNT) {
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
				text: `${litLamps} of ${LAMP_COUNT} lamps are lit. Each one marks a piece of the hub we have reclaimed.`,
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
