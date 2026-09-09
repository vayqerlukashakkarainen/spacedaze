import type { GameObj, PosComp, Vec2 } from "kaplay"
import type { HorizontalDirectionalVisualComp } from "../comp/horizontalDirectionalVisual"
import {
	interactable,
	INTERACTION_PRIORITY,
	type InteractableComp,
} from "../comp/interactable"
import { k, layers, mainSoundVolume, WORLD_CAMERA_SCALE } from "../main"
import { starsEmitter } from "../particles"
import { spawnFlash } from "../spawn/spawnFlash"
import { BURT_TAG } from "../spawn/npcs/spawnHubBurt"
import { tags } from "../tags"
import { createNpcInteractionPrompt } from "../ui/common"
import { HUB_FIRING_RANGE_OFFSET } from "./hubLayoutService"
import { audioService } from "./audioService"
import { registerBatchedEntityUpdate } from "./entityUpdateService"
import {
	cutsceneActive,
	playCutscene,
	type CutsceneContext,
	type CutsceneDefinition,
} from "./cutsceneService"
import {
	completeStrafeTrainingOffer,
	completeStrafeTutorial,
	getHubBurtLocation,
	shouldOfferStrafeTraining,
	shouldShowStrafeTutorial,
	shouldSpawnStrafeTrainingModule,
	unlockStrafeTraining,
} from "./narrativeService"
import { registerNpcDialogueIndicator } from "./npcDialogueIndicatorService"
import { showPopover } from "./popoverService"

const STRAFE_MODULE_TAG = "strafeTrainingModule"
const STRAFE_OFFER_CUTSCENE_ID = "burt-strafe-training-offer"
const STRAFE_TUTORIAL_CUTSCENE_ID = "burt-strafe-training-tutorial"
const BURT_ACTOR = "strafe-burt"
const PLAYER_ACTOR = "strafe-player"
const MODULE_LAUNCH_DURATION = 0.55
const MODULE_INTERACTION_RADIUS = 52
const STRAFE_DIALOGUE_INTERACTION_RADIUS = 92
const STRAFE_DIALOGUE_ID = "strafe-training-offer"
const PROGRESSION_COLOR = [255, 158, 62] as const
const HUB_RING_BURT_OFFSET = [-104, 56] as const

let offerStarting = false
let tutorialStarting = false
const preparedOfferActors = new WeakSet<GameObj>()

const dialogueOptions = {
	gameplay: "paused" as const,
	advance: "manual" as const,
	input: "capture" as const,
	overlayOpacity: 0,
	accentColor: PROGRESSION_COLOR,
}

export async function showStrafeTrainingOfferIfNeeded() {
	if (!shouldOfferStrafeTraining() || offerStarting) return false
	if (cutsceneActive()) return false
	const burt = getBurt()
	const player = getPlayer()
	if (!burt || !player) return false

	offerStarting = true
	try {
		const result = await playCutscene(createOfferCutscene(burt, player), {
			resolveActor: resolveTrainingActor,
		})
		if (result === "cancelled") return false
		completeStrafeTrainingOffer()
		if (shouldSpawnStrafeTrainingModule()) ensureStrafeTrainingModule(burt)
		return true
	} finally {
		offerStarting = false
	}
}

export function restoreStrafeTrainingSequence() {
	const burt = getBurt()
	if (burt && getHubBurtLocation() === "center") {
		burt.pos = k.center().add(...HUB_RING_BURT_OFFSET)
	}
	if (shouldOfferStrafeTraining()) {
		if (burt) prepareStrafeTrainingOffer(burt)
	}
	if (shouldSpawnStrafeTrainingModule()) {
		if (burt) ensureStrafeTrainingModule(burt)
	}
	if (shouldShowStrafeTutorial()) {
		k.wait(0.8, () => void showStrafeTutorialIfNeeded())
	}
}

function prepareStrafeTrainingOffer(burt: GameObj<PosComp>) {
	if (preparedOfferActors.has(burt)) return
	preparedOfferActors.add(burt)
	burt.pos = k.center().add(...HUB_RING_BURT_OFFSET)
	burt.use(interactable(
		STRAFE_DIALOGUE_INTERACTION_RADIUS,
		() => void showStrafeTrainingOfferIfNeeded(),
		INTERACTION_PRIORITY.progressionDialogue
	))
	const interactiveBurt = burt as GameObj<PosComp | InteractableComp>
	const progressionColor = k.rgb(...PROGRESSION_COLOR)
	const prompt = createNpcInteractionPrompt({
		target: interactiveBurt,
		offset: k.vec2(0, -48),
	})
	registerNpcDialogueIndicator({
		actor: interactiveBurt,
		npcId: "burt",
		getDialogueId: () => shouldOfferStrafeTraining()
			? STRAFE_DIALOGUE_ID
			: undefined,
		isVisible: () =>
			!offerStarting && !interactiveBurt.isInRange,
		offset: k.vec2(0, -48),
		color: progressionColor,
	})
	registerBatchedEntityUpdate("world", interactiveBurt, () => {
		const offerAvailable = shouldOfferStrafeTraining() && !offerStarting
		interactiveBurt.setInteractRadius(
			offerAvailable ? STRAFE_DIALOGUE_INTERACTION_RADIUS : 0
		)
		prompt.update(offerAvailable && interactiveBurt.isInRange)
	})
}

function createOfferCutscene(
	burt: GameObj<PosComp>,
	player: GameObj<PosComp>
): CutsceneDefinition {
	const approachSide = burt.pos.x <= player.pos.x ? -1 : 1
	const approachTarget = player.pos.add(approachSide * 54, 4)
	const cameraTarget = approachTarget.lerp(player.pos, 0.5)
	return {
		id: STRAFE_OFFER_CUTSCENE_ID,
		speakerActors: { BURT: BURT_ACTOR },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "action",
				run: () => faceBurtToward(burt, approachTarget),
			},
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: cameraTarget,
						zoom: WORLD_CAMERA_SCALE * 1.45,
						duration: 0.85,
						easing: "easeInOutCubic",
					},
					{
						type: "move",
						actor: BURT_ACTOR,
						target: approachTarget,
						duration: 0.85,
						easing: "easeOutCubic",
						finalizeOnSkip: true,
					},
				],
			},
			{
				type: "action",
				run: () => faceEachOther(burt, player),
			},
			{ type: "wait", duration: 0.18 },
			{
				type: "emotion",
				actor: BURT_ACTOR,
				emotion: "angry",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.34 },
			{
				type: "dialogue",
				lines: [
					{
						speaker: "BURT",
						text: "Back already? The Daze does not forgive sloppy flying.",
					},
					{
						speaker: "BURT",
						text: "Federation patrol echoes know your old flight pattern now.",
					},
				],
				options: dialogueOptions,
				skippable: true,
			},
			{
				type: "emotion",
				actor: PLAYER_ACTOR,
				emotion: "sad",
				options: { duration: 2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "dialogue",
				lines: [
					{
						speaker: "BURT",
						text: "No pilot survives the Void for long without proper strafe control.",
					},
					{
						speaker: "BURT",
						text: "I rebuilt this from a Wake courier stabilizer.",
					},
				],
				options: dialogueOptions,
				skippable: true,
			},
			{
				type: "emotion",
				actor: PLAYER_ACTOR,
				emotion: "question",
				options: { duration: 2.1, priority: "narrative" },
			},
			{ type: "wait", duration: 0.58 },
			{
				type: "dialogue",
				lines: [{
					speaker: "BURT",
					text: "You are the only pilot I have left. Close enough. Stand back.",
				}],
				options: dialogueOptions,
				skippable: true,
			},
			{
				type: "emotion",
				actor: PLAYER_ACTOR,
				emotion: "awkward",
				options: { duration: 2.4, priority: "narrative" },
			},
			{ type: "wait", duration: 0.45 },
			{
				type: "action",
				run: (context) => animateBurtEjection(burt, context),
			},
			{ type: "wait", duration: 0.5 },
		],
	}
}

async function showStrafeTutorialIfNeeded() {
	if (!shouldShowStrafeTutorial() || tutorialStarting) return false
	if (cutsceneActive()) {
		k.wait(0.5, () => void showStrafeTutorialIfNeeded())
		return false
	}
	const burt = getBurt()
	const player = getPlayer()
	if (!burt || !player) return false

	tutorialStarting = true
	try {
		const result = await playCutscene(createTutorialCutscene(burt, player), {
			resolveActor: resolveTrainingActor,
		})
		if (result !== "cancelled") completeStrafeTutorial()
		return result !== "cancelled"
	} finally {
		tutorialStarting = false
	}
}

function createTutorialCutscene(
	burt: GameObj<PosComp>,
	player: GameObj<PosComp>
): CutsceneDefinition {
	const conversationTarget = burt.pos.lerp(player.pos, 0.5)
	const firingRangePosition = k.center().add(...HUB_FIRING_RANGE_OFFSET)
	return {
		id: STRAFE_TUTORIAL_CUTSCENE_ID,
		speakerActors: { BURT: BURT_ACTOR },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "camera",
				target: conversationTarget,
				zoom: WORLD_CAMERA_SCALE * 1.45,
				duration: 0.4,
			},
			{
				type: "emotion",
				actor: BURT_ACTOR,
				emotion: "idea",
				options: { duration: 2.3, priority: "narrative" },
			},
			{ type: "wait", duration: 0.3 },
			{
				type: "dialogue",
				lines: [
					{
						speaker: "BURT",
						text: "That module unlocks strafe control.",
					},
					{
						speaker: "BURT",
						text: "Hold SHIFT while moving. Your hull drifts, but your weapons stay on the cursor.",
					},
					{
						speaker: "BURT",
						text: "Fly one direction. Fire in another. Federation targeting routines hate that.",
					},
				],
				options: dialogueOptions,
				skippable: true,
			},
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: firingRangePosition,
						zoom: WORLD_CAMERA_SCALE * 1.15,
						duration: 0.8,
						easing: "easeInOutCubic",
					},
					{
						type: "emotion",
						actor: BURT_ACTOR,
						emotion: "happy",
						options: { duration: 2.6, priority: "narrative" },
					},
				],
			},
			{
				type: "dialogue",
				lines: [{
					speaker: "BURT",
					text: "The live-fire lane is south of Wake Station. Train there before the Daze teaches you again.",
				}],
				options: dialogueOptions,
				skippable: true,
			},
			{ type: "wait", duration: 0.3 },
		],
	}
}

function ensureStrafeTrainingModule(burt: GameObj<PosComp>) {
	const existing = k.get<GameObj>(STRAFE_MODULE_TAG)[0]
	if (existing?.exists()) return existing
	return spawnStrafeTrainingModule(burt)
}

function spawnStrafeTrainingModule(burt: GameObj<PosComp>) {
	const facing = burt.has("horizontalDirectionalVisual")
		? (burt as GameObj<PosComp | HorizontalDirectionalVisualComp>).facing
		: "right"
	const behindDirection = facing === "right" ? -1 : 1
	const start = burt.pos.add(behindDirection * 8, 12)
	const end = burt.pos.add(behindDirection * 52, 22)
	let launchElapsed = 0
	let armed = false
	let collected = false

	const pickup = k.add([
		k.pos(start),
		k.sprite("target_painter_upg1", { width: 24, height: 24 }),
		k.anchor("center"),
		k.rotate(0),
		k.scale(0.35),
		k.color(k.rgb(150, 225, 255)),
		k.outline(1, k.WHITE),
		k.layer(layers.game),
		k.z(80),
		interactable(MODULE_INTERACTION_RADIUS, collect),
		STRAFE_MODULE_TAG,
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
	]) as GameObj<PosComp | InteractableComp>
	const aura = pickup.add([
		k.circle(20, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(80, 205, 255)),
		k.opacity(0.7),
		k.z(-1),
		k.layer(layers.gameEffects),
	])
	const prompt = createNpcInteractionPrompt({
		target: pickup,
		offset: k.vec2(0, -38),
		label: { text: "STRAFE MODULE", color: k.rgb(150, 225, 255) },
	})

	pickup.onUpdate(() => {
		if (!armed) {
			launchElapsed = Math.min(
				MODULE_LAUNCH_DURATION,
				launchElapsed + k.dt()
			)
			const progress = launchElapsed / MODULE_LAUNCH_DURATION
			pickup.pos = start.lerp(end, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 30
			pickup.scale = k.vec2(k.lerp(0.35, 1, Math.min(1, progress * 2)))
			pickup.angle += 540 * k.dt()
			if (progress >= 1) armed = true
		} else {
			pickup.angle += 35 * k.dt()
			pickup.scale = k.vec2(k.wave(0.96, 1.04, k.time() * 3))
		}
		aura.scale = k.vec2(k.wave(0.9, 1.12, k.time() * 2.4))
		prompt.update(armed && pickup.isInRange)
	})

	function collect() {
		if (!armed || collected) return
		collected = true
		const collectedAt = pickup.pos.clone()
		unlockStrafeTraining()
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(36)
		spawnFlash(collectedAt, 12, k.rgb(100, 220, 255))
		audioService.playSound("powerup1", {
			volume: mainSoundVolume * 0.9,
			detune: 250,
		})
		k.shake(3)
		k.destroy(pickup)
		showPopover({
			title: "PERMANENT UPGRADE",
			message: "STRAFE TRAINING UNLOCKED",
			description: "Hold SHIFT while moving to decouple flight and aim.",
			sprite: "target_painter_upg1",
			color: k.rgb(100, 220, 255),
			duration: 4,
		})
		k.wait(0.45, () => void showStrafeTutorialIfNeeded())
	}

	return pickup
}

function animateBurtEjection(
	burt: GameObj<PosComp>,
	context: CutsceneContext
) {
	return new Promise<void>((resolve) => {
		const startPos = burt.pos.clone()
		const startScale = burt.scale?.clone() ?? k.vec2(1)
		const rotatable = burt as GameObj<PosComp> & { angle?: number }
		const startAngle = rotatable.angle ?? 0
		const duration = 0.62
		let elapsed = 0
		let ejected = false
		let finished = false
		const finish = () => {
			if (finished) return
			finished = true
			update.cancel()
			if (burt.exists()) {
				burt.pos = startPos
				burt.scale = startScale
				if (typeof rotatable.angle === "number") rotatable.angle = startAngle
			}
			resolve()
		}
		const update = k.onUpdate(() => {
			if (context.cancelled || !burt.exists()) {
				finish()
				return
			}
			elapsed = Math.min(duration, elapsed + k.dt())
			const progress = elapsed / duration
			const strain = Math.min(1, progress / 0.48)
			const release = progress < 0.48
				? 0
				: Math.sin((progress - 0.48) / 0.52 * Math.PI)
			burt.pos = startPos.add(
				Math.sin(elapsed * 58) * (1.5 + strain * 2.5),
				strain * 3 - release * 8
			)
			burt.scale = k.vec2(
				startScale.x * (1 + release * 0.18),
				startScale.y * (1 - strain * 0.16 + release * 0.24)
			)
			if (typeof rotatable.angle === "number") {
				rotatable.angle = startAngle + Math.sin(elapsed * 46) * 4
			}
			if (!ejected && progress >= 0.48) {
				ejected = true
				audioService.playPositionalSound(
					"burt_strafe_module_eject",
					() => burt.exists() ? burt.pos : undefined,
					{ volume: mainSoundVolume * 0.9, maxDistance: 700 }
				)
				ensureStrafeTrainingModule(burt)
			}
			if (progress >= 1) finish()
		})
	})
}

function faceBurtToward(burt: GameObj<PosComp>, target: Vec2) {
	if (!burt.has("horizontalDirectionalVisual")) return
	const directionalBurt = burt as GameObj<
		PosComp | HorizontalDirectionalVisualComp
	>
	directionalBurt.faceHorizontal(target.x - burt.pos.x)
}

function faceEachOther(burt: GameObj<PosComp>, player: GameObj<PosComp>) {
	faceBurtToward(burt, player.pos)
	if ("angle" in player) {
		player.angle = burt.pos.sub(player.pos).angle() + 90
	}
}

function resolveTrainingActor(id: string) {
	if (id === BURT_ACTOR) return getBurt()
	if (id === PLAYER_ACTOR) return getPlayer()
	return undefined
}

function getBurt() {
	const burt = k.get<GameObj<PosComp>>(BURT_TAG)[0]
	return burt?.exists() ? burt : undefined
}

function getPlayer() {
	const player = k.get<GameObj<PosComp>>(tags.player)[0]
	return player?.exists() ? player : undefined
}
