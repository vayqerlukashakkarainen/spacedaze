import type { GameObj, PosComp, Vec2 } from "kaplay"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { isSnareMotionActive, snareable } from "../../comp/snareable"
import { addShipThruster } from "../../comp/shipThruster"
import {
	RACE_MARSHAL_DIALOGUE_ID,
	RACE_MARSHAL_NPC_ID,
} from "../../content/dialogue/hubRace"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { k, layers } from "../../main"
import { trailEmitter } from "../../particles"
import { discoverDroid, getDroidDefinition } from "../../npcs/droidRegistry"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { getHubLevel } from "../../services/hub/hubProgressService"
import {
	playCutscene,
	type CutsceneDefinition,
} from "../../services/narrative/cutsceneService"
import {
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { showDialogue } from "../../services/narrative/dialogService"
import { showEmotion } from "../../services/narrative/emotionService"
import { showPopover } from "../../services/ui/popoverService"
import {
	addLocalLight,
	updateLocalLight,
} from "../../services/world/localLightService"
import { lerpAngleBetweenPos } from "../../shared"
import { tags } from "../../tags"
import { createNpcInteractionPrompt, UI_COLORS } from "../../ui/common"
import {
	HUB_RACE_LAMP_PLATFORM_VISUALS,
	HUB_RACE_LAMP_VISUALS,
} from "../../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { addBuildingPlayerDepth } from "../../comp/buildingPlayerDepth"

const REQUIRED_HUB_LEVEL = 4
const RACE_LAMP_COUNT = 24
const RACE_LAMP_SIDE_OFFSET = 34
const RACE_PATH_SAMPLES_PER_SEGMENT = 28
const RACE_LOOK_AHEAD_DISTANCE = 18
const INTERACT_RADIUS = 86
interface RaceBezierNode {
	position: readonly [number, number]
	tangent: readonly [number, number]
}

interface RacePathSample {
	position: Vec2
	distance: number
}

interface RacePath {
	samples: readonly RacePathSample[]
	totalLength: number
}

// These cubic Bezier nodes form one continuous, invisible circuit around the
// outer hub. Keeping the route outside the restoration ring leaves the central
// activity circle clear for facilities, NPCs, and player navigation.
const RACE_BEZIER_NODES: readonly RaceBezierNode[] = [
	{ position: [-1220, -790], tangent: [690, -170] },
	{ position: [-260, -930], tangent: [900, 80] },
	{ position: [1120, -760], tangent: [310, 500] },
	{ position: [1320, -280], tangent: [20, 580] },
	{ position: [1320, 400], tangent: [-310, 170] },
	{ position: [800, 400], tangent: [-620, -20] },
	{ position: [380, 430], tangent: [-330, 130] },
	{ position: [250, 650], tangent: [-80, 410] },
	{ position: [100, 940], tangent: [-900, -70] },
	{ position: [-1170, 690], tangent: [-280, -560] },
	{ position: [-1280, 20], tangent: [30, -610] },
]
const RACER_SPRITES = [
	"hub_ship_ring_runner",
	"hub_ship_gloom",
	"hub_ship_jubilee",
] as const
const RACER_SPEEDS = [150, 185, 220] as const
const HEAVY_RACER_INDEX = 2
const HEAVY_RACER_MASS = 4.2
const HEAVY_RACER_SNARE_FORCE = 150
const RACER_COLORS = [
	[232, 238, 242],
	[172, 208, 220],
	[210, 218, 226],
] as const

export function spawnHubRace() {
	if (getHubLevel() < REQUIRED_HUB_LEVEL) return
	const hubCenter = k.center()
	const path = createRacePath(hubCenter)
	spawnRaceLamps(path)
	for (let index = 0; index < RACER_SPRITES.length; index++) {
		spawnRacer(path, index)
	}
	const marshalFocus = getRacePathPosition(path, path.totalLength * 0.61)
	const marshalPos = marshalFocus.add(
		hubCenter.sub(marshalFocus).unit().scale(118)
	)
	spawnRaceMarshal(marshalPos, marshalFocus)
}

function spawnRacer(path: RacePath, index: number) {
	const isHeavyRacer = index === HEAVY_RACER_INDEX
	let distance = path.totalLength * (
		index / RACER_SPRITES.length + 0.08
	) % path.totalLength
	let snareMotionWasActive = false
	let rejoiningPath = false
	let reactionCooldown = 0
	const startPos = getRacePathPosition(path, distance)
	const racer = k.add([
		k.pos(startPos),
		k.sprite(RACER_SPRITES[index], { width: 32, height: 32 }),
		k.anchor("center"),
		k.rotate(0),
		k.scale(1),
		k.color(
			RACER_COLORS[index][0],
			RACER_COLORS[index][1],
			RACER_COLORS[index][2]
		),
		k.layer(layers.game),
		k.z(10 + index),
		snareable({
			mass: isHeavyRacer ? HEAVY_RACER_MASS : 0.9 + index * 0.15,
			force: isHeavyRacer ? HEAVY_RACER_SNARE_FORCE : 0,
			forceDirection: getRacePathTangent(path, distance),
			radius: 14,
			releaseDrag: 2.5,
			angularDrag: 1.8,
			onSnareStart() {
				if (isHeavyRacer) {
					racer.setSnareForce(
						HEAVY_RACER_SNARE_FORCE,
						getRacePathTangent(path, distance)
					)
				}
				if (reactionCooldown > 0) return
				reactionCooldown = 4
				showRacerLassoReaction(racer, index)
			},
			onSnareEnd() {
				if (isHeavyRacer) racer.setSnareForce(0)
			},
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
	])
	const thruster = addShipThruster(racer, racer.height / 2 - 2)
	const updateThruster = (speed: number, deltaSeconds: number) => {
		if (!thruster.update(speed, deltaSeconds)) return
		trailEmitter.emitter.position = thruster.getExhaustPosition()
		trailEmitter.emitter.direction = racer.angle + 90
		trailEmitter.emit(1)
	}
	registerBatchedEntityUpdate("world", racer, () => {
		const deltaSeconds = k.dt()
		reactionCooldown = Math.max(0, reactionCooldown - deltaSeconds)
		const speed = RACER_SPEEDS[index]
		if (isSnareMotionActive(racer)) {
			snareMotionWasActive = true
			if (isHeavyRacer && racer.snared) {
				distance = (distance + speed * deltaSeconds) % path.totalLength
				const towDirection = getRacePathTangent(path, distance)
				racer.setSnareForce(HEAVY_RACER_SNARE_FORCE, towDirection)
				const desiredVelocity = towDirection.scale(speed)
				racer.snareVelocity = racer.snareVelocity.lerp(
					desiredVelocity,
					1 - Math.exp(-4.5 * deltaSeconds)
				)
				updateThruster(speed, deltaSeconds)
			} else {
				thruster.update(0, deltaSeconds)
			}
			return
		}
		if (snareMotionWasActive) {
			distance = getNearestRacePathDistance(path, racer.pos)
			snareMotionWasActive = false
			rejoiningPath = true
		}
		distance = (distance + speed * deltaSeconds) % path.totalLength
		const nextPos = getRacePathPosition(path, distance)
		const lookAhead = getRacePathPosition(
			path,
			distance + RACE_LOOK_AHEAD_DISTANCE
		)
		if (rejoiningPath) {
			const toPath = nextPos.sub(racer.pos)
			const rejoinStep = speed * 1.35 * deltaSeconds
			if (toPath.len() <= rejoinStep) {
				racer.pos = nextPos
				rejoiningPath = false
			} else {
				racer.pos = racer.pos.add(toPath.unit().scale(rejoinStep))
			}
		} else {
			racer.pos = nextPos
		}
		const turn = lerpAngleBetweenPos(
			racer.angle,
			racer.pos,
			rejoiningPath ? nextPos : lookAhead,
			1 - Math.exp(-9 * deltaSeconds),
			-90
		)
		racer.angle = turn.lerp
		updateThruster(speed, deltaSeconds)
	})
}

function showRacerLassoReaction(racer: GameObj<PosComp>, index: number) {
	showEmotion(racer, "angry", {
		duration: 2.1,
		priority: "interaction",
		sound: {
			id: "ui_hover",
			volume: 0.32,
			speed: [1.12, 0.82, 1.22][index],
		},
	})
	void showDialogue(dialogue.hubRace.racerLassoReactions[index], {
		channel: "comms",
		gameplay: "live",
		advance: "auto",
		input: "passthrough",
		autoAdvanceDelay: 1.15,
		overlayOpacity: 0,
		resolveSpeaker: () => racer.exists() ? racer : undefined,
	})
}

function spawnRaceLamps(path: RacePath) {
	for (let index = 0; index < RACE_LAMP_COUNT; index++) {
		const distance = path.totalLength * index / RACE_LAMP_COUNT
		const routePos = getRacePathPosition(path, distance)
		const tangent = getRacePathTangent(path, distance)
		const trackSide = index % 2 === 0 ? -1 : 1
		const position = routePos.add(
			k.vec2(-tangent.y, tangent.x).scale(
				RACE_LAMP_SIDE_OFFSET * trackSide
			)
		)
		const platformVisual = HUB_RACE_LAMP_PLATFORM_VISUALS[
			index % HUB_RACE_LAMP_PLATFORM_VISUALS.length
		]
		k.add([
			k.pos(position.add(0, 20)),
			k.sprite(requirePrimaryVisualSprite(platformVisual)),
			k.anchor("center"),
			k.scale(platformVisual.worldScale),
			k.color(96, 96, 96),
			k.opacity(0.88),
			k.layer(layers.game2),
			k.z(-20),
			tags.props,
			tags.gameLoop,
		])
		const visual = HUB_RACE_LAMP_VISUALS[index % HUB_RACE_LAMP_VISUALS.length]
		const lamp = k.add([
			k.pos(position),
			k.sprite(requirePrimaryVisualSprite(visual)),
			k.anchor("center"),
			k.scale(visual.worldScale),
			k.color(k.WHITE),
			k.opacity(0.92),
			k.layer(layers.game),
			k.z(-20),
			tags.props,
			tags.gameLoop,
		])
		addBuildingPlayerDepth(lamp)
		const light = addLocalLight(lamp, {
			size: 72,
			color: UI_COLORS.accent,
			opacity: 0.38,
			pulse: {
				scaleMin: 0.9,
				scaleMax: 1.08,
				scaleSpeed: 2.2,
				opacityMin: 0.28,
				opacityMax: 0.48,
				opacitySpeed: 2.5,
			},
		})
		light.object.pos = k.vec2(0, -12)
		lamp.onUpdate(() => updateLocalLight(light))
	}
}

function spawnRaceMarshal(pos: Vec2, raceFocus: Vec2) {
	let talking = false
	const marshal = k.add([
		k.pos(pos),
		k.sprite("hub_droid_race_marshal", { width: 24, height: 24 }),
		k.anchor("center"),
		k.rotate(raceFocus.sub(pos).angle() + 90),
		k.scale(1),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 1,
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
		target: marshal,
		offset: k.vec2(0, -48),
		label: { text: "RACE MARSHAL" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		RACE_MARSHAL_NPC_ID,
		startConversation
	)
	marshal.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: marshal,
		npcId: RACE_MARSHAL_NPC_ID,
		getDialogueId: () => RACE_MARSHAL_DIALOGUE_ID,
		isVisible: () => !talking && !marshal.isInRange,
		offset: k.vec2(0, -48),
		cameraInterest: true,
	})
	registerBatchedEntityUpdate("world", marshal, () => {
		prompt.update(!talking && marshal.isInRange)
	})

	function startConversation() {
		if (talking || !marshal.exists()) return false
		talking = true
		marshal.isInRange = false
		prompt.update(false)
		void playCutscene(createRaceMarshalConversation(raceFocus), {
			resolveActor: (id) => {
				if (id === "raceMarshal") return marshal
				if (id === "player") return k.get<PosComp>(tags.player)[0]
				return undefined
			},
		}).then((result) => {
			if (result !== "completed") return
			markNpcDialogueSeen(
				RACE_MARSHAL_NPC_ID,
				RACE_MARSHAL_DIALOGUE_ID
			)
			showRaceMarshalDiscovery()
		}).finally(() => {
			if (marshal.exists()) talking = false
		})
		return true
	}

	return marshal
}

function createRaceMarshalConversation(raceFocus: Vec2): CutsceneDefinition {
	return {
		id: "hub-race-marshal-conversation",
		speakerActors: { "RACE MARSHAL": "raceMarshal" },
		pauseGameplay: false,
		pauseVisualEffects: false,
		restoreActorRotationsOnEnd: true,
		steps: [
			{
				type: "rotate",
				actor: "raceMarshal",
				target: raceFocus,
				duration: 0.24,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.hubRace.raceMarshal.observation,
				options: {
					gameplay: "live",
					advance: "manual",
					input: "passthrough",
					overlayOpacity: 0,
				},
			},
			{
				type: "emotion",
				actor: "raceMarshal",
				emotion: "happy",
				options: {
					duration: 2.3,
					priority: "narrative",
					sound: { id: "ui_hover", volume: 0.3, speed: 1.12 },
				},
			},
			{ type: "wait", duration: 0.38 },
			{
				type: "rotate",
				actor: "raceMarshal",
				target: "player",
				duration: 0.24,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.hubRace.raceMarshal.restoration,
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

function showRaceMarshalDiscovery() {
	if (!discoverDroid(RACE_MARSHAL_NPC_ID)) return
	const definition = getDroidDefinition(RACE_MARSHAL_NPC_ID)
	if (!definition) return
	showPopover({
		title: "DROID DISCOVERED",
		message: definition.name,
		description: "NEW DROID RECORD ADDED TO THE COMPENDIUM",
		sprite: definition.sprite,
		color: k.rgb(...UI_COLORS.accent),
		duration: 6,
	})
}

function createRacePath(hubCenter: Vec2): RacePath {
	const samples: RacePathSample[] = []
	let totalLength = 0
	let previousPosition: Vec2 | undefined
	for (let segment = 0; segment < RACE_BEZIER_NODES.length; segment++) {
		const start = RACE_BEZIER_NODES[segment]
		const end = RACE_BEZIER_NODES[
			(segment + 1) % RACE_BEZIER_NODES.length
		]
		for (
			let sample = 0;
			sample <= RACE_PATH_SAMPLES_PER_SEGMENT;
			sample++
		) {
			if (segment > 0 && sample === 0) continue
			const t = sample / RACE_PATH_SAMPLES_PER_SEGMENT
			const position = evaluateRaceBezier(hubCenter, start, end, t)
			if (previousPosition) totalLength += previousPosition.dist(position)
			samples.push({ position, distance: totalLength })
			previousPosition = position
		}
	}
	return { samples, totalLength }
}

function evaluateRaceBezier(
	hubCenter: Vec2,
	start: RaceBezierNode,
	end: RaceBezierNode,
	t: number
) {
	const p0 = hubCenter.add(...start.position)
	const p1 = p0.add(k.vec2(...start.tangent).scale(1 / 3))
	const p3 = hubCenter.add(...end.position)
	const p2 = p3.sub(k.vec2(...end.tangent).scale(1 / 3))
	const inverse = 1 - t
	return p0.scale(inverse * inverse * inverse)
		.add(p1.scale(3 * inverse * inverse * t))
		.add(p2.scale(3 * inverse * t * t))
		.add(p3.scale(t * t * t))
}

function getRacePathPosition(path: RacePath, rawDistance: number) {
	const distance = (
		(rawDistance % path.totalLength) + path.totalLength
	) % path.totalLength
	let low = 1
	let high = path.samples.length - 1
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (path.samples[middle].distance < distance) {
			low = middle + 1
		} else {
			high = middle
		}
	}
	const after = path.samples[low]
	const before = path.samples[low - 1]
	const sectionLength = Math.max(0.001, after.distance - before.distance)
	return before.position.lerp(
		after.position,
		(distance - before.distance) / sectionLength
	)
}

function getRacePathTangent(path: RacePath, distance: number) {
	return getRacePathPosition(path, distance + RACE_LOOK_AHEAD_DISTANCE)
		.sub(getRacePathPosition(path, distance - RACE_LOOK_AHEAD_DISTANCE))
		.unit()
}

function getNearestRacePathDistance(path: RacePath, position: Vec2) {
	let nearest = path.samples[0]
	let nearestDistance = nearest.position.dist(position)
	for (let index = 1; index < path.samples.length; index++) {
		const sample = path.samples[index]
		const distance = sample.position.dist(position)
		if (distance >= nearestDistance) continue
		nearest = sample
		nearestDistance = distance
	}
	return nearest.distance
}
