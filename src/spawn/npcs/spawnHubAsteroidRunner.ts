import type { GameObj, PosComp } from "kaplay"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import {
	k,
	layers,
	mainSoundVolume,
	WORLD_CAMERA_SCALE,
} from "../../main"
import { starsEmitterDir, trailEmitter } from "../../particles"
import { getDroidDefinition, discoverDroid } from "../../npcs/droidRegistry"
import { playCutscene, type CutsceneDefinition } from "../../services/narrative/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import {
	completeAsteroidRunnerEncounter,
	shouldShowAsteroidRunnerEncounter,
} from "../../services/narrative/narrativeService"
import { showPopover } from "../../services/ui/popoverService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"
import { spawnEnemyDeathEffect } from "../spawnEnemyDeathEffect"

const INTERACT_RADIUS = 82
const CAMERA_ZOOM_MULTIPLIER = 1.18
const DIALOGUE_ID = "asteroid-ring-attempt"

export function spawnHubAsteroidRunner(fieldCenter: ReturnType<typeof k.vec2>) {
	if (!shouldShowAsteroidRunnerEncounter()) return
	const startPos = fieldCenter.add(-292, 18)
	const impactPos = fieldCenter.add(-202, 4)
	const launchDirection = impactPos.sub(startPos).unit()
	let encounterStarted = false

	const runner = k.add([
		k.pos(startPos),
		k.sprite("hub_ship_ring_runner", { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(launchDirection.angle() + 90),
		k.scale(0.82),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startEncounter,
			INTERACTION_PRIORITY.progressionDialogue
		),
		snareable({
			mass: 1.1,
			radius: 14,
			releaseDrag: 2.5,
			returnAfterRelease: true,
			returnSpeed: 105,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: runner,
		offset: k.vec2(0, -45),
		label: { text: "RING RUNNER" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"ring-runner",
		startEncounter
	)
	runner.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: runner,
		npcId: "ring-runner",
		getDialogueId: () => DIALOGUE_ID,
		isVisible: () => !encounterStarted && !runner.isInRange,
		offset: k.vec2(0, -45),
		cameraInterest: true,
	})

	registerBatchedEntityUpdate("world", runner, () => {
		prompt.update(!encounterStarted && runner.isInRange)
	})

	function startEncounter() {
		if (encounterStarted || !runner.exists()) return false
		encounterStarted = true
		runner.isInRange = false
		prompt.update(false)
		const cutscene = createAsteroidRunnerCutscene(
			runner,
			impactPos,
			launchDirection
		)
		void playCutscene(cutscene, {
			resolveActor: (id) => id === "ringRunner"
				? runner as GameObj<PosComp>
				: undefined,
			onCancel: () => {
				if (runner.exists()) encounterStarted = false
			},
		}).then((result) => {
			if (result === "completed") {
				completeAsteroidRunnerEncounter()
				markNpcDialogueSeen("ring-runner", DIALOGUE_ID)
				showDroidDiscovery()
			}
		})
		return true
	}

	function showDroidDiscovery() {
		if (!discoverDroid("ring-runner")) return
		const definition = getDroidDefinition("ring-runner")
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

function createAsteroidRunnerCutscene(
	runner: GameObj<PosComp> & { angle: number },
	impactPos: ReturnType<typeof k.vec2>,
	launchDirection: ReturnType<typeof k.vec2>
): CutsceneDefinition {
	return {
		id: "hub-asteroid-runner",
		speakerActors: { "RING RUNNER": "ringRunner" },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "ringRunner",
						zoom: WORLD_CAMERA_SCALE * CAMERA_ZOOM_MULTIPLIER,
						duration: 0.55,
						easing: "easeOutCubic",
					},
					{
						type: "wait",
						duration: 0.55,
					},
				],
			},
			{
				type: "emotion",
				actor: "ringRunner",
				emotion: "alert",
				options: {
					duration: 1.8,
					priority: "narrative",
					sound: {
						id: "ui_hover",
						volume: 0.32,
						speed: 1.06,
					},
				},
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "dialogue",
				lines: dialogue.asteroidRunner.introduction,
				options: { overlayOpacity: 0 },
			},
			{
				type: "emotion",
				actor: "ringRunner",
				emotion: "idea",
				options: {
					duration: 2.7,
					priority: "narrative",
					sound: {
						id: "ui_hover",
						volume: 0.4,
						speed: 1.14,
					},
				},
			},
			{ type: "wait", duration: 0.44 },
			{
				type: "dialogue",
				lines: dialogue.asteroidRunner.launch,
				options: { overlayOpacity: 0 },
			},
			{
				type: "action",
				run() {
					runner.angle = launchDirection.angle() + 90
				},
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "emotion",
				actor: "ringRunner",
				emotion: "angry",
				options: {
					duration: 1.8,
					priority: "narrative",
					sound: {
						id: "rammer_launch",
						volume: mainSoundVolume * 0.8,
						minDistance: 35,
						maxDistance: 560,
					},
				},
			},
			{ type: "wait", duration: 0.28 },
			{
				type: "action",
				run() {
					emitLaunchBurst(runner.pos, launchDirection)
				},
			},
			{
				type: "parallel",
				steps: [
					{
						type: "move",
						actor: "ringRunner",
						target: impactPos,
						duration: 0.72,
						easing: "easeInCubic",
					},
					{
						type: "camera",
						target: impactPos,
						zoom: WORLD_CAMERA_SCALE * CAMERA_ZOOM_MULTIPLIER,
						duration: 0.72,
						easing: "easeInCubic",
					},
				],
			},
			{
				type: "action",
				run() {
					if (!runner.exists()) return
					const deathPos = runner.pos.clone()
					k.destroy(runner)
					spawnEnemyDeathEffect(deathPos, 0.9)
					k.shake(4)
				},
			},
			{ type: "wait", duration: 0.55 },
		],
	}
}

function emitLaunchBurst(
	pos: ReturnType<typeof k.vec2>,
	direction: ReturnType<typeof k.vec2>
) {
	const rear = pos.sub(direction.scale(13))
	const exhaustDirection = direction.angle() + 180
	starsEmitterDir.emitter.position = rear
	starsEmitterDir.emitter.direction = exhaustDirection
	starsEmitterDir.emit(20)
	trailEmitter.emitter.position = rear
	trailEmitter.emitter.direction = exhaustDirection
	trailEmitter.emit(12)
}
