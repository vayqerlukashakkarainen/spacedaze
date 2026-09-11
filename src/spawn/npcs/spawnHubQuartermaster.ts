import type { PosComp, Vec2 } from "kaplay"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import {
	QUARTERMASTER_INTRODUCTION_DIALOGUE_ID,
	QUARTERMASTER_NPC_ID,
} from "../../content/dialogue/quartermaster"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { k, layers } from "../../main"
import { discoverDroid } from "../../npcs/droidRegistry"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	playCutscene,
	type CutsceneDefinition,
} from "../../services/narrative/cutsceneService"
import {
	hasSeenNpcDialogue,
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt, UI_COLORS } from "../../ui/common"
import { showQuartermasterShop } from "../../ui/quartermasterShop"

const INTERACT_RADIUS = 86

export function spawnHubQuartermaster(pos: Vec2) {
	let talking = false
	const quartermaster = k.add([
		k.pos(pos),
		k.sprite("hub_droid_quartermaster", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(180),
		k.scale(1.05),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			interact,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 1.25,
			radius: 11,
			releaseDrag: 3,
			returnAfterRelease: true,
			returnSpeed: 90,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
	for (const x of [-9, 9]) {
		quartermaster.add([
			k.rect(4, 7),
			k.pos(x, 3),
			k.anchor("center"),
			k.color(...UI_COLORS.warning),
			k.outline(1, k.rgb(...UI_COLORS.background)),
		])
	}
	const prompt = createNpcInteractionPrompt({
		target: quartermaster,
		offset: k.vec2(0, -48),
		label: { text: "QUARTERMASTER" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		QUARTERMASTER_NPC_ID,
		interact
	)
	quartermaster.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: quartermaster,
		npcId: QUARTERMASTER_NPC_ID,
		getDialogueId: () => hasSeenNpcDialogue(
			QUARTERMASTER_NPC_ID,
			QUARTERMASTER_INTRODUCTION_DIALOGUE_ID
		) ? undefined : QUARTERMASTER_INTRODUCTION_DIALOGUE_ID,
		isVisible: () => !talking && !quartermaster.isInRange,
		offset: k.vec2(0, -48),
		cameraInterest: true,
	})

	registerBatchedEntityUpdate("world", quartermaster, () => {
		prompt.update(!talking && quartermaster.isInRange)
	})

	function interact() {
		if (talking || !quartermaster.exists()) return false
		quartermaster.isInRange = false
		prompt.update(false)
		if (hasSeenNpcDialogue(
			QUARTERMASTER_NPC_ID,
			QUARTERMASTER_INTRODUCTION_DIALOGUE_ID
		)) {
			discoverDroid(QUARTERMASTER_NPC_ID)
			showQuartermasterShop()
			return true
		}

		talking = true
		void playCutscene(createIntroduction(), {
			resolveActor: (id) => {
				if (id === "quartermaster") return quartermaster
				if (id === "player") return k.get<PosComp>(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result !== "completed" || !quartermaster.exists()) return
			markNpcDialogueSeen(
				QUARTERMASTER_NPC_ID,
				QUARTERMASTER_INTRODUCTION_DIALOGUE_ID
			)
			discoverDroid(QUARTERMASTER_NPC_ID)
			showQuartermasterShop()
		}).finally(() => {
			if (quartermaster.exists()) talking = false
		})
		return true
	}

	return quartermaster
}

function createIntroduction(): CutsceneDefinition {
	return {
		id: "hub-quartermaster-introduction",
		speakerActors: { QUARTERMASTER: "quartermaster" },
		pauseGameplay: false,
		pauseVisualEffects: false,
		restoreActorRotationsOnEnd: true,
		steps: [
			{
				type: "rotate",
				actor: "quartermaster",
				target: "player",
				duration: 0.25,
				easing: "easeInOutCubic",
			},
			{
				type: "emotion",
				actor: "quartermaster",
				emotion: "alert",
				options: { duration: 1.7, priority: "narrative" },
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "dialogue",
				lines: dialogue.quartermaster.introduction.lines,
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
