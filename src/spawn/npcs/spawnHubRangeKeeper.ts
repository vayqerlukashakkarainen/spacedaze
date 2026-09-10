import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { isSnareMotionActive, snareable } from "../../comp/snareable"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { k, layers, velocityScale, WORLD_CAMERA_SCALE } from "../../main"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { playCutscene, type CutsceneDefinition } from "../../services/narrative/cutsceneService"
import {
	showDialogue,
	type DialogueLine,
} from "../../services/narrative/dialogService"
import type { EmotionId } from "../../services/narrative/emotionService"
import { showEmotion } from "../../services/narrative/emotionService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getHubLevel } from "../../services/hub/hubProgressService"
import {
	getNextNpcDialogue,
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { showPopover } from "../../services/ui/popoverService"
import {
	spawnBasicBlaster,
	spawnEnemyBlaster,
} from "../../services/combat/projectileHelpers"
import { hasEnemyLineOfSight } from "../../services/enemies/enemyNavigationService"
import { createEnemySpawnProfile } from "../../services/enemies/threatService"
import { jitter } from "../../comp/jitter"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { handleEnemyCombat, registerEnemyLifecycle } from "../newEnemyShared"
import type { HubFiringRange } from "../spawnHubFiringRange"

const INTERACT_RADIUS = 86
const CONVERSATION_ZOOM_MULTIPLIER = 1.25
const FIRING_LANE_TOLERANCE = 6
const MAX_STATIONARY_SHOT_DISTANCE = 150
const TARGET_FOLLOW_DISTANCE = 90
const FIRING_POSITION_TOLERANCE = 5
const KEEPER_MOVE_SPEED = 48
const KEEPER_RETURN_SPEED = 34
const DISPLACEMENT_REACTION_COOLDOWN = 6
const HOSTILITY_DISPLACEMENT_DISTANCE = 96
const HOSTILE_MOVE_SPEED = 52
const HOSTILE_MIN_DISTANCE = 150
const HOSTILE_MAX_DISTANCE = 250
export function spawnHubRangeKeeper(firingRange: HubFiringRange) {
	if (getHubLevel() < 2) return
	const trainingTarget = firingRange.targetPos
	const startPos = trainingTarget.add(126, 36)
	const facingDirection = trainingTarget.sub(startPos).unit()
	const firingLaneNormal = k.vec2(-facingDirection.y, facingDirection.x)
	const firingOffset = startPos
		.sub(trainingTarget)
		.unit()
		.scale(TARGET_FOLLOW_DISTANCE)
	let talking = false
	let shotTimer = k.rand(2.5, 5.5)
	let targetWasDisplaced = false
	let reactionCooldown = 0
	let displacedDistance = 0
	let trackedTargetId: number | undefined
	let previousTargetPos = trainingTarget.clone()
	let turningHostile = false
	let hostileReplacement: ReturnType<typeof spawnHostileRangeKeeper> | undefined
	const watcher = k.add([
		k.pos(startPos),
		k.sprite("hub_ship_range_keeper", { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(facingDirection.angle() + 90),
		k.scale(0.86),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 1.2,
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
		target: watcher,
		offset: k.vec2(0, -52),
		label: { text: "RANGE KEEPER" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"ring-watcher",
		startConversation
	)
	watcher.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: watcher,
		npcId: "ring-watcher",
		getDialogueId: () => getNextNpcDialogue(
			"ring-watcher",
			dialogue.rangeKeeper.variants
		)?.id,
		isVisible: () => !talking && !watcher.isInRange,
		offset: k.vec2(0, -52),
	})

	registerBatchedEntityUpdate("world", watcher, () => {
		prompt.update(!talking && !turningHostile && watcher.isInRange)
		if (talking || turningHostile || isSnareMotionActive(watcher)) return
		reactionCooldown = Math.max(0, reactionCooldown - k.dt())
		const target = firingRange.getPrimaryTarget()
		const currentTargetPos = target?.pos ?? trainingTarget
		if (target && trackedTargetId === target.id) {
			displacedDistance += previousTargetPos.dist(currentTargetPos)
		} else {
			trackedTargetId = target?.id
		}
		previousTargetPos = currentTargetPos.clone()
		const targetOffset = currentTargetPos.sub(trainingTarget)
		const targetDisplaced = target !== undefined && (
			Math.abs(targetOffset.dot(firingLaneNormal)) > FIRING_LANE_TOLERANCE ||
			watcher.pos.dist(currentTargetPos) > MAX_STATIONARY_SHOT_DISTANCE
		)
		if (targetDisplaced && !targetWasDisplaced && reactionCooldown <= 0) {
			showEmotion(watcher, "angry", {
				duration: 1.8,
				priority: "ambient",
				sound: {
					id: "ui_hover",
					volume: 0.3,
					speed: 0.88,
				},
			})
			reactionCooldown = DISPLACEMENT_REACTION_COOLDOWN
		}
		targetWasDisplaced = targetDisplaced
		if (displacedDistance >= HOSTILITY_DISPLACEMENT_DISTANCE) {
			turnRangeKeeperHostile()
			return
		}

		const aimDirection = currentTargetPos.sub(watcher.pos)
		if (aimDirection.len() > 0) {
			watcher.angle = aimDirection.angle() + 90
		}
		const desiredFiringPos = currentTargetPos.add(firingOffset)
		const firingPositionDelta = desiredFiringPos.sub(watcher.pos)
		const targetMoving = Array.isArray(target?.knockbackImpulses) &&
			target.knockbackImpulses.length > 0
		const repositioning = targetDisplaced &&
			firingPositionDelta.len() > FIRING_POSITION_TOLERANCE
		if (repositioning) {
			watcher.move(firingPositionDelta.unit().scale(
				Math.min(KEEPER_MOVE_SPEED, firingPositionDelta.len() / k.dt())
			))
		} else if (!targetDisplaced) {
			const returnDirection = startPos.sub(watcher.pos)
			if (returnDirection.len() > 1) {
				watcher.move(returnDirection.unit().scale(
					Math.min(KEEPER_RETURN_SPEED, returnDirection.len() / k.dt())
				))
			}
		}
		if (targetMoving || repositioning) return
		shotTimer -= k.dt()
		if (shotTimer > 0) return
		shotTimer = k.rand(4.5, 8.5)
		fireCalibrationShot(watcher.pos, currentTargetPos)
	})

	function startConversation() {
		if (talking || turningHostile || !watcher.exists()) return false
		const dialogueVariant = getNextNpcDialogue(
			"ring-watcher",
			dialogue.rangeKeeper.variants
		)
		if (!dialogueVariant) return false
		talking = true
		watcher.isInRange = false
		prompt.update(false)
		void playCutscene(createRingWatcherConversation(
			dialogueVariant.id,
			dialogueVariant.lines
		), {
			resolveActor: (id) => {
				if (id === "ringWatcher") return watcher
				if (id === "player") return k.get(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result === "completed") {
				markNpcDialogueSeen("ring-watcher", dialogueVariant.id)
				showDroidDiscovery()
			}
		}).finally(() => {
			if (watcher.exists()) talking = false
		})
		return true
	}

	function showDroidDiscovery() {
		if (!discoverDroid("ring-watcher")) return
		const definition = getDroidDefinition("ring-watcher")
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

	function turnRangeKeeperHostile() {
		if (turningHostile || !watcher.exists()) return
		turningHostile = true
		watcher.isInRange = false
		watcher.setInteractRadius(0)
		prompt.update(false)
		showEmotion(watcher, "angry", {
			duration: 2.6,
			priority: "narrative",
			sound: {
				id: "ui_hover",
				volume: 0.42,
				speed: 0.78,
			},
		})
		k.wait(0.65, () => {
			if (!watcher.exists()) return
			const hostilePos = watcher.pos.clone()
			const hostileAngle = watcher.angle
			k.destroy(watcher)
			hostileReplacement = spawnHostileRangeKeeper(hostilePos, hostileAngle)
			showEmotion(hostileReplacement, "angry", {
				duration: 1.95,
				priority: "narrative",
			})
			void showDialogue(dialogue.rangeKeeper.hostile, {
				channel: "comms",
				gameplay: "live",
				advance: "auto",
				input: "passthrough",
				autoAdvanceDelay: 1.15,
				overlayOpacity: 0,
				resolveSpeaker: () => hostileReplacement?.exists()
					? hostileReplacement
					: undefined,
			})
		})
	}

	return watcher
}

function spawnHostileRangeKeeper(pos: ReturnType<typeof k.vec2>, angle: number) {
	const visual = getEnemyVisual("range-keeper")
	const profile = createEnemySpawnProfile(9, 1, visual.worldScale, {
		persistOffscreen: true,
	})
	const hostile = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(visual), { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(angle),
		k.scale(profile.scale),
		k.color(k.WHITE),
		k.health(profile.hp),
		k.animate(),
		timescale(),
		jitter(),
		k.layer(layers.game),
		k.z(12),
		{
			hb: 12 * profile.scale,
			damage: profile.damage,
			fireTimer: 0.4,
			moveDirection: k.vec2(0, 1),
			strafeDirection: k.chance(0.5) ? -1 : 1,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.gameLoop,
	])
	registerEnemyLifecycle(hostile, profile, 0, 0)

	registerBatchedEntityUpdate("enemies", hostile, () => {
		const delta = k.dt() * hostile.getTimescale()
		const toPlayer = playerObj.pos.sub(hostile.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const desiredDirection = distance < HOSTILE_MIN_DISTANCE
			? direction.scale(-1)
			: distance > HOSTILE_MAX_DISTANCE
				? direction
				: direction.normal().scale(hostile.strafeDirection)
		hostile.moveDirection = hostile.moveDirection.lerp(
			desiredDirection,
			1 - Math.exp(-4 * delta)
		)
		if (hostile.moveDirection.len() > 0.01) {
			hostile.move(hostile.moveDirection.unit().scale(
				HOSTILE_MOVE_SPEED *
					profile.speedMultiplier *
					velocityScale() *
					hostile.getTimescale()
			))
		}
		hostile.angle = direction.angle() + 90
		hostile.fireTimer -= delta * (hostile.shieldFireRateMultiplier ?? 1)
		if (
			hostile.fireTimer <= 0 &&
			distance < 430 &&
			hasEnemyLineOfSight(hostile, playerObj.pos)
		) {
			spawnEnemyBlaster(
				hostile.pos.add(direction.scale(14)),
				direction,
				hostile.angle,
				hostile.damage,
				{ name: "RANGE KEEPER", sprite: "hub_ship_range_keeper" },
				hostile
			)
			hostile.fireTimer = 1.15
		}
		handleEnemyCombat(
			hostile,
			"RANGE KEEPER",
			"hub_ship_range_keeper"
		)
	})

	return hostile
}

function createRingWatcherConversation(
	dialogueId: string,
	lines: readonly DialogueLine[]
): CutsceneDefinition {
	const reaction = ringWatcherReaction(dialogueId)
	const reactionIndex = Math.max(1, lines.length - 1)
	return {
		id: "hub-ring-watcher-conversation",
		speakerActors: { "RANGE KEEPER": "ringWatcher" },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "ringWatcher",
						zoom: WORLD_CAMERA_SCALE * CONVERSATION_ZOOM_MULTIPLIER,
						duration: 0.4,
						easing: "easeOutCubic",
					},
					{
						type: "rotate",
						actor: "ringWatcher",
						target: "player",
						duration: 0.3,
						easing: "easeInOutCubic",
					},
				],
			},
			{
				type: "dialogue",
				lines: lines.slice(0, reactionIndex),
				options: {
					gameplay: "paused",
					advance: "manual",
					input: "capture",
					overlayOpacity: 0,
				},
			},
			{
				type: "emotion",
				actor: "ringWatcher",
				emotion: reaction,
				options: {
					duration: 2.2,
					priority: "narrative",
					sound: {
						id: "ui_hover",
						volume: 0.34,
						speed: reaction === "angry" ? 0.92 : 1.12,
					},
				},
			},
			{ type: "wait", duration: 0.5 },
			{
				type: "dialogue",
				lines: lines.slice(reactionIndex),
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

function ringWatcherReaction(dialogueId: string): EmotionId {
	switch (dialogueId) {
		case "range-introduction":
			return "idea"
		case "forge-calibration":
			return "happy"
		case "range-expansion":
			return "impressed"
		case "restoration-complete":
			return "happy"
		default:
			return "question"
	}
}

function fireCalibrationShot(
	startPos: ReturnType<typeof k.vec2>,
	trainingTarget: ReturnType<typeof k.vec2>
) {
	const direction = trainingTarget.sub(startPos).unit()
	return spawnBasicBlaster(
		startPos.add(direction.scale(15)),
		direction,
		direction.angle() + 90,
		2,
		0.55,
		[tags.friendly, tags.blaster],
		false,
		{ suppressHitRecoil: true }
	)
}
