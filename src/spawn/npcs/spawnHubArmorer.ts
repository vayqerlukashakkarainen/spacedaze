import type { GameObj, PosComp, Vec2 } from "kaplay"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import {
	ARMORER_NPC_ID,
	ARMORER_INTRODUCTION_DIALOGUE_ID,
	hasArmorerIntroduction,
} from "../../services/hub/armorerService"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import type { DialogueLine } from "../../content/dialogue/types"
import { k, layers, WORLD_CAMERA_SCALE } from "../../main"
import { discoverDroid } from "../../npcs/droidRegistry"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	playCutscene,
	type CutsceneDefinition,
} from "../../services/narrative/cutsceneService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { tags } from "../../tags"
import {
	formatInputBinding,
	getInputBinding,
} from "../../services/input/inputBindingService"
import { createNpcInteractionPrompt } from "../../ui/common"
import { spawnPhaseCorePickup } from "../spawnPhaseCore"

const INTERACT_RADIUS = 86
const ARMORER_CONVERSATION_ZOOM = 1.3
const PRIMARY_WEAPON_ROW_ZOOM = 0.88

export function spawnHubArmorer(pos: Vec2, primaryWeaponsPos: Vec2) {
	let talking = false
	const armorer = k.add([
		k.pos(pos),
		k.sprite("hub_droid_armorer", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(0),
		k.scale(1.15),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 1.1,
			radius: 11,
			releaseDrag: 2.8,
			returnAfterRelease: true,
			returnSpeed: 95,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: armorer,
		offset: k.vec2(0, -48),
		label: { text: "ARMORER" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		ARMORER_NPC_ID,
		startConversation
	)
	armorer.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: armorer,
		npcId: ARMORER_NPC_ID,
		getDialogueId: () => hasArmorerIntroduction()
			? undefined
			: ARMORER_INTRODUCTION_DIALOGUE_ID,
		isVisible: () => !talking && !armorer.isInRange,
		offset: k.vec2(0, -48),
		cameraInterest: true,
	})

	registerBatchedEntityUpdate("world", armorer, () => {
		prompt.update(!talking && armorer.isInRange)
	})

	function startConversation() {
		if (talking || !armorer.exists()) return false
		const firstMeeting = !hasArmorerIntroduction()
		const dialogueContent = firstMeeting
			? dialogue.armorer.introduction
			: dialogue.armorer.service
		const resolvedLines = resolveArmorerBindings(dialogueContent.lines)
		talking = true
		armorer.isInRange = false
		prompt.update(false)
		void playCutscene(createArmorerConversation(
			dialogueContent.id,
			resolvedLines,
			primaryWeaponsPos
		), {
			resolveActor: (id) => {
				if (id === "armorer") return armorer
				if (id === "player") return k.get<PosComp>(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result !== "completed") return
			markNpcDialogueSeen(ARMORER_NPC_ID, dialogueContent.id)
			if (firstMeeting) {
				discoverDroid(ARMORER_NPC_ID)
				const player = k.get<PosComp>(tags.player)[0]
				if (player?.exists()) {
					spawnPhaseCorePickup(armorer.pos.clone(), {
						target: player,
						forceToTarget: true,
						source: "armorer",
						objectTags: [],
					})
				}
			}
		}).finally(() => {
			if (armorer.exists()) talking = false
		})
		return true
	}

	return armorer
}

function createArmorerConversation(
	dialogueId: string,
	lines: readonly DialogueLine[],
	primaryWeaponsPos: Vec2
): CutsceneDefinition {
	const firstMeeting = dialogueId === ARMORER_INTRODUCTION_DIALOGUE_ID
	const focusLineCount = firstMeeting ? 2 : 1
	return {
		id: "hub-armorer-conversation",
		speakerActors: { ARMORER: "armorer" },
		pauseGameplay: true,
		pauseVisualEffects: false,
		restoreActorRotationsOnEnd: true,
		steps: [
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "armorer",
						zoom: WORLD_CAMERA_SCALE * ARMORER_CONVERSATION_ZOOM,
						duration: 0.45,
						easing: "easeOutCubic",
					},
					{
						type: "rotate",
						actor: "armorer",
						target: "player",
						duration: 0.3,
						easing: "easeInOutCubic",
					},
				],
			},
			{
				type: "dialogue",
				lines: lines.slice(0, focusLineCount),
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			...(firstMeeting ? [
				{
					type: "emotion" as const,
					actor: "armorer",
					emotion: "idea" as const,
					options: {
						duration: 2.1,
						priority: "narrative" as const,
					},
				},
				{ type: "wait" as const, duration: 0.42 },
			] : []),
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: primaryWeaponsPos,
						zoom: WORLD_CAMERA_SCALE * PRIMARY_WEAPON_ROW_ZOOM,
						duration: 0.65,
						easing: "easeInOutCubic",
					},
					{
						type: "rotate",
						actor: "armorer",
						target: primaryWeaponsPos,
						duration: 0.38,
						easing: "easeInOutCubic",
					},
				],
			},
			{ type: "wait", duration: 0.22 },
			{
				type: "dialogue",
				lines: lines.slice(focusLineCount),
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			{
				type: "restoreCamera",
				duration: 0.4,
				easing: "easeInOutCubic",
			},
		],
	}
}

function resolveArmorerBindings(lines: readonly DialogueLine[]): DialogueLine[] {
	const primaryWheel = formatInputBinding(getInputBinding("primaryWheel"))
	return lines.map((line) => ({
		...line,
		text: typeof line.text === "string"
			? line.text.replaceAll("{{PRIMARY_WHEEL}}", primaryWheel)
			: line.text.map((segment) => ({
				...segment,
				text: segment.text.replaceAll("{{PRIMARY_WHEEL}}", primaryWheel),
			})),
	}))
}
