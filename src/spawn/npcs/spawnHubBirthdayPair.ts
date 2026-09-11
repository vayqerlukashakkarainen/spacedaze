import type { AudioPlay } from "kaplay"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import { k, layers, WORLD_CAMERA_SCALE } from "../../main"
import {
	discoverDroid,
	getDroidDefinition,
	type DroidId,
} from "../../npcs/droidRegistry"
import { audioService } from "../../services/audio/audioService"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { playCutscene, type CutsceneDefinition } from "../../services/narrative/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import {
	completeBirthdayEncounter,
	shouldShowBirthdayEncounter,
} from "../../services/narrative/narrativeService"
import { showPopover } from "../../services/ui/popoverService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"
import { spawnEnemyDeathEffect } from "../spawnEnemyDeathEffect"

const INTERACT_RADIUS = 92
const DIALOGUE_ID = "birthday-incident"
const POST_BIRTHDAY_DIALOGUE_ID = "birthday-aftermath"

export function spawnHubBirthdayPair(center: ReturnType<typeof k.vec2>) {
	const gloomPos = center.add(-72, 0)
	if (!shouldShowBirthdayEncounter()) {
		spawnPostBirthdayGloom(gloomPos)
		return
	}
	const jubileePos = center.add(72, 0)
	let encounterStarted = false
	let jubileeAlive = true
	let birthdaySong: AudioPlay | null = null
	const gloom = spawnBirthdayDroid(
		gloomPos,
		"hub_ship_gloom",
		90,
		startEncounter,
		INTERACTION_PRIORITY.progressionDialogue
	)
	const jubilee = spawnBirthdayDroid(
		jubileePos,
		"hub_ship_jubilee",
		-90,
		startEncounter,
		INTERACTION_PRIORITY.progressionDialogue
	)
	const gloomPrompt = createNpcInteractionPrompt({
		target: gloom,
		offset: k.vec2(0, -42),
		label: { text: "GLOOM" },
	})
	const jubileePrompt = createNpcInteractionPrompt({
		target: jubilee,
		offset: k.vec2(0, -42),
		label: { text: "JUBILEE" },
	})
	const unregisterDialogueTriggers = [
		registerNpcDialogueTrigger("birthday", startEncounter),
		registerNpcDialogueTrigger("gloom", startEncounter),
		registerNpcDialogueTrigger("jubilee", startEncounter),
	]
	const unregisterAllDialogueTriggers = () => {
		for (const unregister of unregisterDialogueTriggers) unregister()
	}
	gloom.onDestroy(unregisterAllDialogueTriggers)
	jubilee.onDestroy(unregisterAllDialogueTriggers)
	registerNpcDialogueIndicator({
		actor: gloom,
		npcId: "gloom",
		getDialogueId: () => DIALOGUE_ID,
		isVisible: () => !encounterStarted && !gloom.isInRange,
		offset: k.vec2(0, -42),
		cameraInterest: true,
	})
	registerNpcDialogueIndicator({
		actor: jubilee,
		npcId: "jubilee",
		getDialogueId: () => DIALOGUE_ID,
		isVisible: () =>
			!encounterStarted && jubileeAlive && !jubilee.isInRange,
		offset: k.vec2(0, -42),
		cameraInterest: true,
	})

	registerBatchedEntityUpdate("world", gloom, () => {
		gloomPrompt.update(!encounterStarted && gloom.isInRange)
		jubileePrompt.update(
			!encounterStarted && jubileeAlive && jubilee.exists() && jubilee.isInRange
		)
	})

	function startEncounter() {
		if (encounterStarted || !gloom.exists() || !jubilee.exists()) return false
		encounterStarted = true
		gloom.isInRange = false
		jubilee.isInRange = false
		gloomPrompt.update(false)
		jubileePrompt.update(false)
		void playCutscene(createBirthdayCutscene(), {
			resolveActor: (id) => {
				if (id === "gloom") return gloom
				if (id === "jubilee" && jubilee.exists()) return jubilee
				return undefined
			},
			onCancel: () => {
				if (birthdaySong) audioService.stopSound(birthdaySong, "cutscene-cancelled")
				birthdaySong = null
				if (gloom.exists() && jubileeAlive) encounterStarted = false
			},
		}).then((result) => {
			if (result === "completed") {
				completeBirthdayEncounter()
				markNpcDialogueSeen("gloom", DIALOGUE_ID)
				markNpcDialogueSeen("jubilee", DIALOGUE_ID)
				showDroidDiscovery("gloom")
				showDroidDiscovery("jubilee")
				if (gloom.exists()) {
					const aftermathPos = gloom.pos.clone()
					k.destroy(gloom)
					spawnPostBirthdayGloom(aftermathPos)
				}
			}
		}).finally(() => {
			if (birthdaySong) audioService.stopSound(birthdaySong, "cutscene-ended")
			birthdaySong = null
		})
		return true
	}

	function createBirthdayCutscene(): CutsceneDefinition {
		return {
			id: "hub-birthday-incident",
			speakerActors: {
				GLOOM: "gloom",
				JUBILEE: "jubilee",
			},
			pauseGameplay: true,
			pauseVisualEffects: false,
			steps: [
				{
					type: "camera",
					target: center,
					zoom: WORLD_CAMERA_SCALE * 1.2,
					duration: 0.55,
					easing: "easeOutCubic",
				},
				{
					type: "dialogue",
					lines: dialogue.birthdayPair.introduction,
					options: { overlayOpacity: 0 },
				},
				{
					type: "emotion",
					actor: "jubilee",
					emotion: "idea",
					options: {
						duration: 2.1,
						priority: "narrative",
						sound: { id: "ui_hover", volume: 0.34, speed: 1.12 },
					},
				},
				{ type: "wait", duration: 0.38 },
				{
					type: "dialogue",
					lines: dialogue.birthdayPair.discovery,
					options: { overlayOpacity: 0 },
				},
				{
					type: "emotion",
					actor: "gloom",
					emotion: "fear",
					options: { duration: 2.2, priority: "narrative" },
				},
				{ type: "wait", duration: 0.44 },
				{
					type: "dialogue",
					lines: dialogue.birthdayPair.celebration,
					options: { overlayOpacity: 0 },
				},
				{
					type: "parallel",
					steps: [
						{
							type: "emotion",
							actor: "jubilee",
							emotion: "music",
							options: { duration: 7.5, priority: "narrative" },
						},
						{
							type: "emotion",
							actor: "gloom",
							emotion: "awkward",
							options: { duration: 2.4, priority: "narrative" },
						},
					],
				},
				{ type: "wait", duration: 0.62 },
				{
					type: "dialogue",
					lines: dialogue.birthdayPair.refusal,
					options: { overlayOpacity: 0 },
				},
				{
					type: "emotion",
					actor: "gloom",
					emotion: "angry",
					options: { duration: 7.2, priority: "narrative" },
				},
				{ type: "wait", duration: 0.3 },
				{
					type: "action",
					run() {
						birthdaySong = gameSoundService.playPositional(
							"birthday_upbeat",
							() => jubilee.exists() ? jubilee.pos : undefined,
							{
								volume: 0.72,
								minDistance: 45,
								maxDistance: 620,
								voiceLimit: false,
							}
						)
					},
				},
				{ type: "wait", duration: 6 },
				{
					type: "action",
					run() {
						if (gloom.exists() && jubilee.exists()) {
							spawnScriptedShot(gloom.pos, jubilee.pos)
						}
					},
				},
				{ type: "wait", duration: 0.24 },
				{
					type: "action",
					run() {
						if (birthdaySong) audioService.stopSound(birthdaySong, "story-event")
						birthdaySong = null
						if (!jubilee.exists()) return
						const deathPos = jubilee.pos.clone()
						jubileeAlive = false
						k.destroy(jubilee)
						spawnEnemyDeathEffect(deathPos, 0.85)
					},
				},
				{ type: "wait", duration: 0.45 },
			],
		}
	}

	function showDroidDiscovery(id: DroidId) {
		if (!discoverDroid(id)) return
		const definition = getDroidDefinition(id)
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
}

function spawnPostBirthdayGloom(pos: ReturnType<typeof k.vec2>) {
	let talking = false
	const gloom = spawnBirthdayDroid(pos, "hub_ship_gloom", 90, startConversation)
	const prompt = createNpcInteractionPrompt({
		target: gloom,
		offset: k.vec2(0, -42),
		label: { text: "GLOOM" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"gloom",
		startConversation
	)
	gloom.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: gloom,
		npcId: "gloom",
		getDialogueId: () => POST_BIRTHDAY_DIALOGUE_ID,
		isVisible: () => !talking && !gloom.isInRange,
		offset: k.vec2(0, -42),
		cameraInterest: true,
	})
	registerBatchedEntityUpdate("world", gloom, () => {
		prompt.update(!talking && gloom.isInRange)
	})

	function startConversation() {
		if (talking || !gloom.exists()) return false
		talking = true
		gloom.isInRange = false
		prompt.update(false)
		void playCutscene({
			id: "hub-gloom-birthday-aftermath",
			speakerActors: { GLOOM: "gloom" },
			pauseGameplay: false,
			pauseVisualEffects: false,
			steps: [
				{
					type: "emotion",
					actor: "gloom",
					emotion: "heartbroken",
					options: {
						duration: 2.6,
						priority: "narrative",
					},
				},
				{ type: "wait", duration: 0.68 },
				{
					type: "dialogue",
					lines: dialogue.birthdayPair.postBirthday,
					options: {
						gameplay: "live",
						advance: "manual",
						input: "passthrough",
						overlayOpacity: 0,
					},
				},
			],
		}, {
			resolveActor: (id) => id === "gloom" ? gloom : undefined,
		}).then((result) => {
			if (result === "completed") {
				markNpcDialogueSeen("gloom", POST_BIRTHDAY_DIALOGUE_ID)
			}
		}).finally(() => {
			if (gloom.exists()) talking = false
		})
		return true
	}

	return gloom
}

function spawnBirthdayDroid(
	pos: ReturnType<typeof k.vec2>,
	sprite: string,
	angle: number,
	onInteract: () => void,
	interactionPriority: number = INTERACTION_PRIORITY.dialogue
) {
	return k.add([
		k.pos(pos),
		k.sprite(sprite, { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(angle),
		k.scale(0.9),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			onInteract,
			interactionPriority
		),
		snareable({
			mass: 0.95,
			radius: 13,
			releaseDrag: 2.7,
			returnAfterRelease: true,
			returnSpeed: 95,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
}

function spawnScriptedShot(
	start: ReturnType<typeof k.vec2>,
	target: ReturnType<typeof k.vec2>
) {
	const direction = target.sub(start).unit()
	return k.add([
		k.pos(start.add(direction.scale(14))),
		k.sprite("bullet1"),
		k.anchor("center"),
		k.rotate(direction.angle() + 90),
		k.scale(1.15),
		k.color(k.WHITE),
		k.opacity(1),
		k.move(direction, start.dist(target) / 0.24),
		k.lifespan(0.3),
		k.layer(layers.game2),
		k.z(20),
		tags.gameLoop,
	])
}
