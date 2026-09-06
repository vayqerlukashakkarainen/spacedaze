import type { AudioPlay } from "kaplay"
import { interactable } from "../../comp/interactable"
import { k, layers, subSoundVolume, WORLD_CAMERA_SCALE } from "../../main"
import {
	discoverDroid,
	getDroidDefinition,
	type DroidId,
} from "../../npcs/droidRegistry"
import { audioService } from "../../services/audioService"
import { playCutscene, type CutsceneDefinition } from "../../services/cutsceneService"
import type { DialogueLine } from "../../services/dialogService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/npcDialogueIndicatorService"
import {
	completeBirthdayEncounter,
	shouldShowBirthdayEncounter,
} from "../../services/narrativeService"
import { showPopover } from "../../services/popoverService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"
import { randomExplosion } from "../../util"
import { spawnEnemyDeathEffect } from "../spawnEnemyDeathEffect"

const INTERACT_RADIUS = 92
const DIALOGUE_ID = "birthday-incident"
const POST_BIRTHDAY_DIALOGUE_ID = "birthday-aftermath"
const POST_BIRTHDAY_LINES: readonly DialogueLine[] = [
	{ speaker: "GLOOM", text: "I hate birthdays…" },
]
const INTRO_LINES: readonly DialogueLine[] = [
	{ speaker: "JUBILEE", text: "You look unusually miserable today. Even for you." },
	{ speaker: "GLOOM", text: "I am performing inventory reconciliation." },
	{
		speaker: "JUBILEE",
		text: [
			{ text: "Wait. ", waitAfter: 0.34 },
			{ text: "GLOOM", reference: { kind: "npc", id: "gloom" } },
			{ text: ", your activation date is today!" },
		],
	},
	{ speaker: "GLOOM", text: "That information was not intended for recreational use." },
	{
		speaker: "JUBILEE",
		text: [
			{ text: "I love birthdays.", waitAfter: 0.34 },
			{ text: " I have exactly the song for this." },
		],
	},
	{ speaker: "GLOOM", text: "Do not." },
]

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
	const gloom = spawnBirthdayDroid(gloomPos, "drone_medic", 90, startEncounter)
	const jubilee = spawnBirthdayDroid(jubileePos, "drone_combat", -90, startEncounter)
	const gloomPrompt = createNpcInteractionPrompt({
		target: gloom,
		offset: k.vec2(0, -42),
	})
	const jubileePrompt = createNpcInteractionPrompt({
		target: jubilee,
		offset: k.vec2(0, -42),
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
	})
	registerNpcDialogueIndicator({
		actor: jubilee,
		npcId: "jubilee",
		getDialogueId: () => DIALOGUE_ID,
		isVisible: () =>
			!encounterStarted && jubileeAlive && !jubilee.isInRange,
		offset: k.vec2(0, -42),
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
		showDroidDiscovery("gloom")
		showDroidDiscovery("jubilee")
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
				markNpcDialogueSeen("gloom", DIALOGUE_ID)
				markNpcDialogueSeen("jubilee", DIALOGUE_ID)
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
					lines: INTRO_LINES.slice(0, 2),
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
					lines: INTRO_LINES.slice(2, 3),
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
					lines: INTRO_LINES.slice(3, 5),
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
					lines: INTRO_LINES.slice(5),
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
						birthdaySong = audioService.playPositionalSound(
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
						completeBirthdayEncounter()
						k.destroy(jubilee)
						spawnEnemyDeathEffect(deathPos, 0.85, true)
						audioService.playPositionalSound(randomExplosion(), deathPos, {
							volume: subSoundVolume,
							minDistance: 35,
							maxDistance: 580,
						})
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
			description: "NEW DROID RECORD ADDED TO THE PHASE STATION",
			sprite: definition.sprite,
			color: k.rgb(0, 220, 255),
			duration: 6,
		})
	}
}

function spawnPostBirthdayGloom(pos: ReturnType<typeof k.vec2>) {
	let talking = false
	const gloom = spawnBirthdayDroid(pos, "drone_medic", 90, startConversation)
	const prompt = createNpcInteractionPrompt({
		target: gloom,
		offset: k.vec2(0, -42),
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
					lines: POST_BIRTHDAY_LINES,
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
	onInteract: () => void
) {
	return k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(angle),
		k.scale(0.9),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(INTERACT_RADIUS, onInteract),
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
