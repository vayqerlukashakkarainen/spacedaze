import type { GameObj, PosComp, Vec2 } from "kaplay"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import type { HorizontalDirectionalVisualComp } from "../../comp/horizontalDirectionalVisual"
import type { SnareableComp } from "../../comp/snareable"
import {
	interactable,
	INTERACTION_PRIORITY,
	type InteractableComp,
} from "../../comp/interactable"
import { k, layers, mainSoundVolume, WORLD_CAMERA_SCALE } from "../../main"
import { starsEmitter } from "../../particles"
import { spawnFlash } from "../../spawn/spawnFlash"
import { BURT_TAG } from "../../spawn/npcs/spawnHubBurt"
import { tags } from "../../tags"
import { createNpcInteractionPrompt, UI_COLORS } from "../../ui/common"
import { HUB_FIRING_RANGE_OFFSET } from "./hubLayoutService"
import { gameSoundService } from "../audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import {
	cutsceneActive,
	playCutscene,
	type CutsceneContext,
	type CutsceneDefinition,
} from "../narrative/cutsceneService"
import {
	completeStrafeTrainingOffer,
	completeStrafeTutorial,
	completeLassoConstruction,
	completeLassoTutorial,
	getHubBurtLocation,
	shouldOfferLassoConstruction,
	shouldSpawnBuiltLasso,
	shouldShowLassoTutorial,
	shouldOfferStrafeTraining,
	shouldShowStrafeTutorial,
	shouldSpawnStrafeTrainingModule,
	unlockStrafeTraining,
	unlockBuiltLasso,
} from "../narrative/narrativeService"
import { registerNpcDialogueIndicator } from "../narrative/npcDialogueIndicatorService"
import { showPopover } from "../ui/popoverService"
import {
	formatInputBinding,
	getInputBinding,
	isInputActionDown,
} from "../input/inputBindingService"
import { addLvl, getPermanentUpgradeLevel } from "../../upg"
import { spawnRewardPickup } from "../../spawn/spawnPowerup"
import type { Reward } from "../economy/rewardService"
import { RewardRarity } from "../../types/rewardTypes"
import { showEmotion } from "../narrative/emotionService"
import {
	forEachSpatialNearby,
	getMaxProjectileSweepDistance,
} from "../core/runtimeSpatialIndexService"
import { applyProjectileDamage } from "../combat/projectileService"
import { playVisualHitKnockback } from "../combat/visualHitKnockbackService"

const STRAFE_MODULE_TAG = "strafeTrainingModule"
const STRAFE_OFFER_CUTSCENE_ID = "burt-strafe-training-offer"
const STRAFE_TUTORIAL_CUTSCENE_ID = "burt-strafe-training-tutorial"
const BURT_ACTOR = "strafe-burt"
const PLAYER_ACTOR = "strafe-player"
const MODULE_LAUNCH_DURATION = 0.55
const MODULE_INTERACTION_RADIUS = 52
const STRAFE_DIALOGUE_INTERACTION_RADIUS = 92
const STRAFE_DIALOGUE_ID = "strafe-training-offer"
const LASSO_DIALOGUE_ID = "lasso-construction-offer"
const LASSO_PICKUP_TAG = "builtSalvageLasso"
const PROGRESSION_COLOR = [255, 158, 62] as const
const HUB_RING_BURT_OFFSET = [-104, 56] as const
const STRAFE_TRAINING_DAMAGE = 18
const STRAFE_TRAINING_HIT_RADIUS = 18

let offerStarting = false
let tutorialStarting = false
let lassoConstructionStarting = false
let lassoTutorialStarting = false
const preparedOfferActors = new WeakSet<GameObj>()

const dialogueOptions = {
	gameplay: "paused" as const,
	advance: "manual" as const,
	input: "capture" as const,
	overlayOpacity: 0,
}

const BUILT_LASSO_REWARD: Reward = {
	id: "builtSalvageLasso",
	kind: "upgrade",
	upgradeKey: "salvageLasso",
	levelIndex: 0,
	name: "SALVAGE LASSO",
	description: "Tow and throw loose objects with a phase tether.",
	stats: { lasso: "UNLOCKED" },
	sprite: "salvage_lasso",
	rarity: RewardRarity.Legendary,
	progression: {
		persistence: "permanent",
		repeatability: "once",
		rarity: { mode: "fixed", value: RewardRarity.Legendary },
	},
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
	if (shouldOfferStrafeTraining() || shouldOfferLassoConstruction()) {
		if (burt) prepareBurtProgressionOffer(burt)
	}
	if (shouldSpawnStrafeTrainingModule()) {
		if (burt) ensureStrafeTrainingModule(burt)
	}
	if (shouldShowStrafeTutorial()) {
		k.wait(0.8, () => void showStrafeTutorialIfNeeded())
	}
	if (
		burt &&
		shouldSpawnBuiltLasso() &&
		getPermanentUpgradeLevel("salvageLasso") === undefined
	) ensureBuiltLasso(burt)
	if (burt && shouldShowLassoTutorial()) {
		k.wait(0.55, () => startLassoHandlingTutorial(burt))
	}
}

function prepareBurtProgressionOffer(burt: GameObj<PosComp>) {
	if (preparedOfferActors.has(burt)) return
	preparedOfferActors.add(burt)
	burt.pos = k.center().add(...HUB_RING_BURT_OFFSET)
	burt.use(interactable(
		STRAFE_DIALOGUE_INTERACTION_RADIUS,
		() => void showBurtProgressionIfNeeded(),
		INTERACTION_PRIORITY.progressionDialogue
	))
	const interactiveBurt = burt as GameObj<PosComp | InteractableComp>
	const progressionColor = k.rgb(...PROGRESSION_COLOR)
	const prompt = createNpcInteractionPrompt({
		target: interactiveBurt,
		offset: k.vec2(0, -48),
		label: { text: "BURT" },
	})
	registerNpcDialogueIndicator({
		actor: interactiveBurt,
		npcId: "burt",
		getDialogueId: () => shouldOfferStrafeTraining()
			? STRAFE_DIALOGUE_ID
			: shouldOfferLassoConstruction()
				? LASSO_DIALOGUE_ID
				: undefined,
		isVisible: () =>
			!offerStarting &&
			!lassoConstructionStarting &&
			!interactiveBurt.isInRange,
		offset: k.vec2(0, -48),
		color: progressionColor,
	})
	registerBatchedEntityUpdate("world", interactiveBurt, () => {
		const offerAvailable = (
			shouldOfferStrafeTraining() || shouldOfferLassoConstruction()
		) && !offerStarting && !lassoConstructionStarting
		interactiveBurt.setInteractRadius(
			offerAvailable ? STRAFE_DIALOGUE_INTERACTION_RADIUS : 0
		)
		prompt.update(offerAvailable && interactiveBurt.isInRange)
	})
}

function showBurtProgressionIfNeeded() {
	if (shouldOfferStrafeTraining()) {
		void showStrafeTrainingOfferIfNeeded()
		return
	}
	if (shouldOfferLassoConstruction()) {
		void showLassoConstructionIfNeeded()
	}
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
				lines: dialogue.strafeTraining.offer.failure,
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
				lines: dialogue.strafeTraining.offer.explanation,
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
				lines: dialogue.strafeTraining.offer.ejection,
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
	const result = await playCutscene(createTutorialExplanationCutscene(
		burt,
		player
	), {
		resolveActor: resolveTrainingActor,
	})
	if (result === "cancelled") {
		tutorialStarting = false
		return false
	}
	startStrafeTargetPractice(burt)
	return true
}

function createTutorialExplanationCutscene(
	burt: GameObj<PosComp>,
	player: GameObj<PosComp>
): CutsceneDefinition {
	const conversationTarget = burt.pos.lerp(player.pos, 0.5)
	const strafeBinding = formatInputBinding(getInputBinding("strafe"))
	const tutorialDialogue = dialogue.strafeTraining.tutorial(strafeBinding)
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
				lines: tutorialDialogue.explanation,
				options: dialogueOptions,
				skippable: true,
			},
		],
	}
}

function startStrafeTargetPractice(burt: GameObj<PosComp>) {
	if (!burt.exists() || !shouldShowStrafeTutorial()) {
		tutorialStarting = false
		return
	}
	const strafeBinding = formatInputBinding(getInputBinding("strafe"))
	const target = k.add([
		k.pos(burt.pos),
		k.circle(STRAFE_TRAINING_HIT_RADIUS),
		k.anchor("center"),
		k.opacity(0),
		{
			hp: STRAFE_TRAINING_DAMAGE,
			maxHP: STRAFE_TRAINING_DAMAGE,
			hb: STRAFE_TRAINING_HIT_RADIUS,
			enemyType: "training-burt",
		},
		tags.enemy,
		tags.unit,
		tags.gameLoop,
	])
	const prompt = createNpcInteractionPrompt({
		target: burt,
		offset: k.vec2(0, -54),
		inputAction: "primary",
		requireInteractionTarget: false,
		label: () => ({
			text: `HOLD ${strafeBinding} // HIT BURT ${Math.max(0, Math.ceil(target.hp))}`,
			color: k.rgb(...UI_COLORS.danger),
		}),
	})
	let finished = false
	target.onUpdate(() => {
		if (finished) return
		if (!burt.exists() || !shouldShowStrafeTutorial()) {
			finish(false)
			return
		}
		target.pos = burt.pos.clone()
		prompt.update(true)
		checkStrafeTrainingProjectileHits(target, burt)
		if (target.hp <= 0) finish(true)
	})

	function finish(completed: boolean) {
		if (finished) return
		finished = true
		prompt.update(false)
		if (target.exists()) k.destroy(target)
		if (!completed) {
			tutorialStarting = false
			return
		}
		showEmotion(burt, "dizzy", {
			duration: 2.2,
			priority: "narrative",
		})
		k.wait(0.42, () => void showStrafeTrainingConclusion(burt))
	}
}

function checkStrafeTrainingProjectileHits(target: GameObj, burt: GameObj) {
	if (!isInputActionDown("strafe")) return
	const queryRadius = STRAFE_TRAINING_HIT_RADIUS +
		getMaxProjectileSweepDistance() + 12
	forEachSpatialNearby(target.pos, queryRadius, {
		allTags: [tags.projectile, tags.friendly],
	}, (projectile) => {
		const start = projectile.previousPos ?? projectile.pos
		const hitRadius = STRAFE_TRAINING_HIT_RADIUS +
			Math.max(2, Number(projectile.hb) || 3)
		if (!segmentHitsCircle(start, projectile.pos, target.pos, hitRadius)) return
		const impactDirection = projectile.dir?.clone()
		const shouldDestroy = applyProjectileDamage(target, projectile)
		if (shouldDestroy && projectile.exists()) k.destroy(projectile)
		if (impactDirection?.len() > 0.001) {
			playVisualHitKnockback(burt, impactDirection)
		}
		spawnFlash(burt.pos.clone(), 5, k.rgb(...PROGRESSION_COLOR))
	})
}

async function showStrafeTrainingConclusion(burt: GameObj<PosComp>) {
	if (!burt.exists()) {
		tutorialStarting = false
		return false
	}
	if (cutsceneActive()) {
		k.wait(0.5, () => void showStrafeTrainingConclusion(burt))
		return false
	}
	const strafeBinding = formatInputBinding(getInputBinding("strafe"))
	const tutorialDialogue = dialogue.strafeTraining.tutorial(strafeBinding)
	const firingRangePosition = k.center().add(...HUB_FIRING_RANGE_OFFSET)
	try {
		const result = await playCutscene({
			id: `${STRAFE_TUTORIAL_CUTSCENE_ID}-conclusion`,
			speakerActors: { BURT: BURT_ACTOR },
			pauseGameplay: true,
			pauseVisualEffects: false,
			steps: [
				{
					type: "dialogue",
					lines: tutorialDialogue.targetPracticeComplete,
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
					lines: tutorialDialogue.trainingGrounds,
					options: dialogueOptions,
					skippable: true,
				},
			],
		}, { resolveActor: resolveTrainingActor })
		if (result !== "cancelled") completeStrafeTutorial()
		return result !== "cancelled"
	} finally {
		tutorialStarting = false
	}
}

function segmentHitsCircle(start: Vec2, end: Vec2, center: Vec2, radius: number) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared <= 0.0001) return start.dist(center) <= radius
	const progress = k.clamp(center.sub(start).dot(segment) / lengthSquared, 0, 1)
	return start.add(segment.scale(progress)).dist(center) <= radius
}

async function showLassoConstructionIfNeeded() {
	if (!shouldOfferLassoConstruction() || lassoConstructionStarting) return false
	if (cutsceneActive()) return false
	const burt = getBurt()
	const player = getPlayer()
	if (!burt || !player) return false

	lassoConstructionStarting = true
	try {
		const result = await playCutscene(
			createLassoConstructionCutscene(burt, player),
			{ resolveActor: resolveTrainingActor }
		)
		if (result === "cancelled") return false
		completeLassoConstruction()
		ensureBuiltLasso(burt)
		return true
	} finally {
		lassoConstructionStarting = false
	}
}

function createLassoConstructionCutscene(
	burt: GameObj<PosComp>,
	player: GameObj<PosComp>
): CutsceneDefinition {
	const conversationTarget = burt.pos.lerp(player.pos, 0.5)
	return {
		id: "burt-lasso-construction",
		speakerActors: { BURT: BURT_ACTOR },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "camera",
				target: conversationTarget,
				zoom: WORLD_CAMERA_SCALE * 1.45,
				duration: 0.5,
				easing: "easeInOutCubic",
			},
			{ type: "action", run: () => faceEachOther(burt, player) },
			{
				type: "emotion",
				actor: BURT_ACTOR,
				emotion: "idea",
				options: { duration: 2.1, priority: "narrative" },
			},
			{ type: "wait", duration: 0.34 },
			{
				type: "dialogue",
				lines: dialogue.lassoConstruction.inspection,
				options: dialogueOptions,
				skippable: true,
			},
			{
				type: "action",
				run: (context) => animateLassoConstruction(burt, context),
			},
			{
				type: "emotion",
				actor: BURT_ACTOR,
				emotion: "happy",
				options: { duration: 2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.28 },
			{
				type: "dialogue",
				lines: dialogue.lassoConstruction.construction,
				options: dialogueOptions,
				skippable: true,
			},
		],
	}
}

function animateLassoConstruction(
	burt: GameObj<PosComp>,
	context: CutsceneContext
) {
	return new Promise<void>((resolve) => {
		const duration = 1.35
		let elapsed = 0
		let toolSoundPlayed = false
		const update = k.onUpdate(() => {
			if (context.cancelled || !burt.exists()) {
				update.cancel()
				resolve()
				return
			}
			elapsed = Math.min(duration, elapsed + k.dt())
			if (!toolSoundPlayed) {
				toolSoundPlayed = true
				gameSoundService.playPositional(
					"burt_repair_hammer",
					() => burt.exists() ? burt.pos : undefined,
					{ volume: mainSoundVolume * 0.8, maxDistance: 700 }
				)
			}
			burt.setVisualLean?.(Math.sin(elapsed * 38) * 5)
			if (Math.floor(elapsed * 8) !== Math.floor((elapsed - k.dt()) * 8)) {
				spawnFlash(burt.pos.add(18, 12), 3, k.rgb(...PROGRESSION_COLOR))
			}
			if (elapsed < duration) return
			update.cancel()
			burt.settleVisual?.()
			gameSoundService.playPositional(
				"burt_repair_tool",
				() => burt.exists() ? burt.pos : undefined,
				{ volume: mainSoundVolume * 0.85, maxDistance: 700 }
			)
			resolve()
		})
	})
}

function ensureBuiltLasso(burt: GameObj<PosComp>) {
	const existing = k.get<GameObj>(LASSO_PICKUP_TAG)[0]
	if (existing?.exists()) return existing
	const facing = burt.has("horizontalDirectionalVisual")
		? (burt as GameObj<PosComp | HorizontalDirectionalVisualComp>).facing
		: "right"
	const direction = facing === "right" ? 1 : -1
	return spawnRewardPickup(burt.pos.add(direction * 18, 8), BUILT_LASSO_REWARD, {
		stationary: true,
		interactionOnly: true,
		interactionRadius: MODULE_INTERACTION_RADIUS,
		interactionPromptStyle: "key",
		interactionPromptLabel: {
			text: "TAKE SALVAGE LASSO",
			color: k.rgb(...PROGRESSION_COLOR),
		},
		compactAura: false,
		suppressAcquisition: true,
		tags: [LASSO_PICKUP_TAG, tags.gameLoop],
		launch: {
			endOffset: k.vec2(direction * 54, 18),
			height: 28,
			duration: 0.58,
		},
		applyEffect: () => {
			if (getPermanentUpgradeLevel("salvageLasso") !== undefined) return false
			if (addLvl("salvageLasso") === undefined) return false
			return unlockBuiltLasso()
		},
		onCollected: () => {
			showPopover({
				title: "PERMANENT UPGRADE",
				message: "SALVAGE LASSO UNLOCKED",
				description: `Press ${formatInputBinding(getInputBinding("lasso"))} to tether loose objects and smaller enemies.`,
				sprite: "salvage_lasso",
				color: k.rgb(...PROGRESSION_COLOR),
				duration: 4,
			})
			k.wait(0.55, () => startLassoHandlingTutorial(burt))
		},
	})
}

function startLassoHandlingTutorial(burt: GameObj<PosComp>) {
	if (
		lassoTutorialStarting ||
		!shouldShowLassoTutorial() ||
		!burt.exists()
	) return
	if (cutsceneActive()) {
		k.wait(0.5, () => startLassoHandlingTutorial(burt))
		return
	}
	if (!burt.has("snareable")) return

	lassoTutorialStarting = true
	const snareableBurt = burt as GameObj<PosComp | SnareableComp>
	let tethered = snareableBurt.snared
	let panicShown = false
	const prompt = createNpcInteractionPrompt({
		target: snareableBurt,
		offset: k.vec2(0, -54),
		inputAction: "lasso",
		requireInteractionTarget: false,
		label: () => ({
			text: tethered
				? "LET GO OF ME! PRESS Q AGAIN!"
				: "AIM AT BURT // PRESS Q TO LASSO",
			color: tethered
				? k.rgb(...UI_COLORS.danger)
				: k.rgb(...PROGRESSION_COLOR),
		}),
	})
	const controller = k.add([
		{
			update() {
				if (!burt.exists() || !shouldShowLassoTutorial()) {
					prompt.update(false)
					lassoTutorialStarting = false
					k.destroy(controller)
					return
				}
				if (snareableBurt.snared) {
					tethered = true
					if (!panicShown) {
						panicShown = true
						showEmotion(burt, "fear", {
							duration: 3,
							priority: "narrative",
						})
					}
					prompt.update(true)
					return
				}
				if (!tethered) {
					prompt.update(true)
					return
				}
				prompt.update(false)
				k.destroy(controller)
				k.wait(0.35, () => void showLassoOriginDialogue(burt))
			},
		},
		tags.gameLoop,
	])
}

async function showLassoOriginDialogue(burt: GameObj<PosComp>) {
	if (!burt.exists()) {
		lassoTutorialStarting = false
		return false
	}
	if (cutsceneActive()) {
		k.wait(0.5, () => void showLassoOriginDialogue(burt))
		return false
	}
	try {
		const result = await playCutscene({
			id: "burt-lasso-handling-tutorial",
			speakerActors: { BURT: BURT_ACTOR },
			pauseGameplay: true,
			pauseVisualEffects: false,
			steps: [
				{
					type: "emotion",
					actor: BURT_ACTOR,
					emotion: "dizzy",
					options: { duration: 2.2, priority: "narrative" },
				},
				{ type: "wait", duration: 0.38 },
				{
					type: "dialogue",
					lines: dialogue.lassoConstruction.tutorial.panic,
					options: dialogueOptions,
					skippable: true,
				},
				{
					type: "emotion",
					actor: BURT_ACTOR,
					emotion: "impressed",
					options: { duration: 2, priority: "narrative" },
				},
				{ type: "wait", duration: 0.3 },
				{
					type: "dialogue",
					lines: dialogue.lassoConstruction.tutorial.origins,
					options: dialogueOptions,
					skippable: true,
				},
			],
		}, { resolveActor: resolveTrainingActor })
		if (result !== "cancelled") completeLassoTutorial()
		return result !== "cancelled"
	} finally {
		lassoTutorialStarting = false
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
		label: { text: "TAKE STRAFE MODULE", color: k.rgb(150, 225, 255) },
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
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.9,
			detune: 250,
		})
		k.shake(3)
		k.destroy(pickup)
		showPopover({
			title: "PERMANENT UPGRADE",
			message: "STRAFE TRAINING UNLOCKED",
			description: `Hold ${formatInputBinding(getInputBinding("strafe"))} for independent flight and aim.`,
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
				gameSoundService.playPositional(
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
