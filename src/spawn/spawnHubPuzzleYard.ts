import type { ColorComp, GameObj, PosComp, RotateComp, Vec2 } from "kaplay"
import { snareable, type SnareableComp } from "../comp/snareable"
import {
	getHubPuzzleStampDefinition,
	HUB_PUZZLE_STAMP_PLACEMENTS,
	type HubCargoObstacleStampElement,
	type HubCargoPressStampDefinition,
	type HubLiveCircuitStampDefinition,
	type HubPuzzleStampPlacement,
	type HubStampPoint,
} from "../stamps/hub/hubPuzzleStampCatalog"
import { playerObj } from "../game"
import { k, layers, mainSoundVolume } from "../main"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { getHubLevel } from "../services/hub/hubProgressService"
import {
	traceElectricalNetwork,
	type ElectricalNode,
} from "../services/world/electricalConductionService"
import { registerPushableInteractionPhysics } from "../services/world/interactionPhysicsService"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common"
import { spawnFlash } from "./spawnFlash"
import { spawnPsionicPlatePickup } from "./spawnPsionicPlate"
import { spawnRing } from "./spawnRing"
import { spawnThrusterPartPickup } from "./spawnThrusterPart"
import {
	drawElectricalTrace,
	spawnTeslaCoilVisual,
} from "./rooms/spawnTeslaCoil"

type HubPuzzleCrate = GameObj<
	PosComp | RotateComp | ColorComp | SnareableComp
>

export function spawnHubPuzzleStamps(hubCenter: Vec2) {
	for (const placement of HUB_PUZZLE_STAMP_PLACEMENTS) {
		const definition = getHubPuzzleStampDefinition(placement.stampId)
		if (getHubLevel() < definition.minimumHubLevel) continue
		spawnHubPuzzleStamp(hubCenter, placement)
	}
}

function spawnHubPuzzleStamp(
	hubCenter: Vec2,
	placement: HubPuzzleStampPlacement
) {
	const definition = getHubPuzzleStampDefinition(placement.stampId)
	const center = hubCenter.add(...placement.offset)
	if (definition.type === "live-circuit") {
		spawnHubCircuitPuzzle(center, placement.rotation, definition)
		return
	}
	spawnHubPressurePlatePuzzle(center, placement.rotation, definition)
}

function spawnHubCircuitPuzzle(
	center: Vec2,
	rotation: number,
	definition: HubLiveCircuitStampDefinition
) {
	let completed = false
	const sourceCoil = spawnTeslaCoilVisual(getHubStampPosition(
		center,
		definition.sourceCoilOffset,
		rotation
	))
	const targetCoil = spawnTeslaCoilVisual(getHubStampPosition(
		center,
		definition.targetCoilOffset,
		rotation
	), false)
	const conductors = definition.conductors.map((conductor) =>
		spawnHubPuzzleConductor(
			getHubStampPosition(center, conductor.offset, rotation),
			conductor.sprite,
			conductor.angle + rotation,
			conductor.scale,
			conductor.radius,
			conductor.mass
		)
	)
	const source: ElectricalNode = {
		id: sourceCoil.object.id,
		position: sourceCoil.object.pos,
	}
	let trace = traceElectricalNetwork(
		source,
		getCircuitNodes(conductors, targetCoil.object),
		definition.linkDistance
	)
	const status = spawnPuzzleHeader(
		getHubStampPosition(center, definition.headerOffset, rotation),
		definition.title
	)

	const controller = k.add([
		k.pos(),
		k.layer(layers.gameEffects),
		k.z(8),
		{
			draw() {
				drawElectricalTrace(trace, completed ? 0.9 : 0.7)
			},
		},
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("world", controller, () => {
		trace = traceElectricalNetwork(
			source,
			getCircuitNodes(conductors, targetCoil.object),
			definition.linkDistance
		)
		if (completed || !trace.poweredIds.has(targetCoil.object.id)) return
		completed = true
		targetCoil.setPowered(true)
		status.text = "CIRCUIT COMPLETE  //  HEALTH CURRENCY RELEASED"
		spawnPuzzleCompletionFeedback(targetCoil.object.pos, UI_COLORS.psionicPlate)
		spawnPsionicPlatePickup(getHubStampPosition(
			center,
			definition.rewardOffset,
			rotation
		), {
			source: "hubPuzzle",
			objectTags: [tags.gameLoop],
		})
	})
}

function spawnHubPuzzleConductor(
	position: Vec2,
	sprite: string,
	angle: number,
	scale: number,
	radius: number,
	mass: number
) {
	const conductor = k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(angle),
		k.scale(scale),
		k.color(190, 196, 200),
		k.opacity(0.92),
		k.layer(layers.game2),
		k.z(3),
		snareable({
			mass,
			radius,
			releaseDrag: 2.6,
			angularDrag: 1.7,
		}),
		tags.props,
		tags.unit,
		tags.gameLoop,
	])
	registerHubPuzzlePushPhysics(conductor, {
		radius,
		mass,
	})
	return conductor
}

function getCircuitNodes(
	conductors: ReturnType<typeof spawnHubPuzzleConductor>[],
	target: GameObj<PosComp>
) {
	const nodes: ElectricalNode[] = conductors
		.filter((conductor) => conductor.exists())
		.map((conductor) => ({ id: conductor.id, position: conductor.pos }))
	if (target.exists()) nodes.push({ id: target.id, position: target.pos })
	return nodes
}

function spawnHubPressurePlatePuzzle(
	center: Vec2,
	rotation: number,
	definition: HubCargoPressStampDefinition
) {
	let completed = false
	const crateStart = getHubStampPosition(center, definition.crate.offset, rotation)
	const platePosition = getHubStampPosition(center, definition.plate.offset, rotation)
	const maze = spawnHubScrapMaze(center, rotation, definition.obstacles)
	const status = spawnPuzzleHeader(
		getHubStampPosition(center, definition.headerOffset, rotation),
		definition.title
	)
	const plate = spawnHubPressurePlate(
		platePosition,
		definition.plate.radius,
		() => completed
	)
	const crate = k.add([
		k.pos(crateStart),
		k.sprite(definition.crate.sprite),
		k.anchor("center"),
		k.rotate(definition.crate.angle + rotation),
		k.scale(definition.crate.scale),
		k.color(k.WHITE),
		k.outline(1, k.rgb(...UI_COLORS.accent)),
		k.layer(layers.game),
		k.z(3),
		snareable({
			mass: definition.crate.mass,
			radius: definition.crate.radius,
			releaseDrag: 2.4,
			angularDrag: 1.5,
			canSnare: () => !completed,
		}),
		tags.props,
		tags.unit,
		tags.gameLoop,
	]) as HubPuzzleCrate
	registerHubPuzzlePushPhysics(crate, {
		radius: definition.crate.radius,
		mass: definition.crate.mass,
		canPush: () => !completed,
	})

	const controller = k.add([k.pos(), tags.gameLoop])
	registerBatchedEntityUpdate("world", controller, () => {
		if (completed || !crate.exists()) return
		resolveMazeCollision(crate, definition.crate.radius, maze)
		if (
			crate.snared ||
			crate.snareVelocity.len() > definition.plate.captureSpeed
		) return
		if (crate.pos.dist(platePosition) > definition.plate.captureRadius) return
		completed = true
		crate.pos = platePosition.clone()
		crate.angle = 0
		crate.snareVelocity = k.vec2()
		crate.snareAngularVelocity = 0
		crate.color = k.rgb(...UI_COLORS.success)
		status.text = "PRESSURE LOCKED  //  THRUSTER CURRENCY RELEASED"
		spawnPuzzleCompletionFeedback(plate.pos, UI_COLORS.thrusterPart)
		spawnThrusterPartPickup(getHubStampPosition(
			center,
			definition.rewardOffset,
			rotation
		), {
			objectTags: [tags.gameLoop],
		})
	})
}

interface HubScrapMazePiece {
	position: Vec2
	radius: number
}

function spawnHubScrapMaze(
	center: Vec2,
	rotation: number,
	obstacles: readonly HubCargoObstacleStampElement[]
) {
	return obstacles.map((obstacle) => {
		const position = getHubStampPosition(center, obstacle.offset, rotation)
		k.add([
			k.pos(position),
			k.sprite(obstacle.sprite),
			k.anchor("center"),
			k.rotate(obstacle.angle + rotation),
			k.scale(obstacle.scale),
			k.color(obstacle.shade, obstacle.shade + 8, obstacle.shade + 16),
			k.opacity(0.9),
			k.layer(layers.game2),
			k.z(-1),
			tags.props,
			tags.gameLoop,
		])
		return { position, radius: obstacle.radius }
	})
}

function resolveMazeCollision(
	crate: HubPuzzleCrate,
	crateRadius: number,
	maze: readonly HubScrapMazePiece[]
) {
	for (const obstacle of maze) {
		const offset = crate.pos.sub(obstacle.position)
		const minimumDistance = crateRadius + obstacle.radius
		const distance = offset.len()
		if (distance >= minimumDistance) continue
		const normal = distance > 0.001
			? offset.scale(1 / distance)
			: k.Vec2.fromAngle(crate.id % 360)
		crate.pos = obstacle.position.add(normal.scale(minimumDistance))
		const inwardSpeed = Math.min(0, crate.snareVelocity.dot(normal))
		crate.snareVelocity = crate.snareVelocity.sub(normal.scale(inwardSpeed))
		crate.snareAngularVelocity *= 0.82
	}
}

function spawnHubPressurePlate(
	position: Vec2,
	baseRadius: number,
	isCompleted: () => boolean
) {
	return k.add([
		k.pos(position),
		k.layer(layers.gameEffects),
		k.z(-1),
		{
			draw() {
				const active = isCompleted()
				const color = active
					? k.rgb(...UI_COLORS.success)
					: k.rgb(...UI_COLORS.accent)
				const drawRadius = active
					? baseRadius
					: k.wave(23, 26, k.time() * 2.6)
				k.drawCircle({
					radius: drawRadius,
					color,
					opacity: active ? 0.28 : 0.08,
					outline: { width: 2, color, opacity: active ? 1 : 0.72 },
				})
				k.drawRect({
					pos: k.vec2(),
					width: 14,
					height: 14,
					anchor: "center",
					color,
					opacity: active ? 0.78 : 0.18,
				})
			},
		},
		tags.props,
		tags.gameLoop,
	])
}

function getHubStampPosition(
	center: Vec2,
	offset: HubStampPoint,
	rotation: number
) {
	if (rotation === 0) return center.add(...offset)
	const radians = rotation * Math.PI / 180
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	return center.add(
		offset[0] * cos - offset[1] * sin,
		offset[0] * sin + offset[1] * cos
	)
}

function spawnPuzzleHeader(position: Vec2, title: string) {
	return k.add([
		k.pos(position),
		k.text(title, {
			font: "unscii",
			size: 10,
			width: 300,
			align: "center",
		}),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
		k.layer(layers.gameText),
		tags.gameLoop,
	])
}

interface HubPuzzlePushOptions {
	radius: number
	mass: number
	canPush?: () => boolean
}

function registerHubPuzzlePushPhysics(
	target: HubPuzzleCrate,
	options: HubPuzzlePushOptions
) {
	registerPushableInteractionPhysics(target, {
		radius: options.radius,
		mass: options.mass,
		maxSpeed: 240,
		pushTransfer: 0.9,
		separationResponse: 13,
		getPusher: () => playerObj,
		pusherRadius: 10,
		canPush: () => options.canPush?.() ?? true,
	})
}

function spawnPuzzleCompletionFeedback(
	position: Vec2,
	color: readonly [number, number, number]
) {
	spawnFlash(position, 22, k.WHITE)
	spawnRing({
		pos: position,
		speed: 190,
		maxRadius: 72,
		intensity: 0.78,
		color: k.rgb(...color),
	})
	gameSoundService.play("room_cleared", {
		volume: mainSoundVolume * 0.82,
		detune: 220,
	})
	k.shake(3)
}
