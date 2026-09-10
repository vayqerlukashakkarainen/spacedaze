import type { Vec2 } from "kaplay"
import type { RoomEnvironmentObjectPlan } from "../../generation/rooms/roomFloorTypes"
import { k, layers, mainSoundVolume } from "../../main"
import { sparkEmitter } from "../../particles"
import { gameSoundService } from "../../services/audio/gameSoundService"
import {
	applySlowdownTrapEffect,
	queryTrapTargets,
	registerTrapCellTrigger,
	type TrapCellTarget,
} from "../../services/world/trapCellService"
import { tags } from "../../tags"
import { spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"

const PLATE_RADIUS = 16
const TRIGGER_RADIUS = 18
const PULSE_RADIUS = 48
const COOLDOWN_SECONDS = 3.6
const SLOWDOWN_DURATION = 3
const SLOWDOWN_MULTIPLIER = 0.42
const ACTIVATION_FLASH_DURATION = 0.24
const STASIS_COLOR = [85, 185, 255] as const

export function spawnSlowdownPlate(
	_plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	let triggerController: ReturnType<typeof registerTrapCellTrigger> | undefined
	const plate = k.add([
		k.pos(position),
		k.layer(layers.game2),
		k.z(-1),
		{
			draw() {
				drawSlowdownPlate(
					triggerController?.cooldownRemaining() ?? 0,
					triggerController?.activationFlashRemaining() ?? 0
				)
			},
		},
		tags.props,
		tags.roomEnvironment,
		tags.roomTrap,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])

	triggerController = registerTrapCellTrigger({
		owner: plate,
		position,
		triggerRadius: TRIGGER_RADIUS,
		cooldownSeconds: COOLDOWN_SECONDS,
		activationFlashSeconds: ACTIVATION_FLASH_DURATION,
		onTriggered: (target) => activateSlowdownPlate(position, target),
	})

	return plate
}

function activateSlowdownPlate(
	position: Vec2,
	triggerTarget: TrapCellTarget
) {
	const affected = new Map<number, TrapCellTarget>([[triggerTarget.id, triggerTarget]])
	for (const target of queryTrapTargets(position, PULSE_RADIUS)) {
		affected.set(target.id, target)
	}
	for (const target of affected.values()) {
		applySlowdownTrapEffect(
			target,
			SLOWDOWN_MULTIPLIER,
			SLOWDOWN_DURATION
		)
		spawnSlowTargetFlash(target)
	}

	const stasisColor = k.rgb(...STASIS_COLOR)
	spawnFlash(position, 16, stasisColor)
	spawnRing({
		pos: position,
		speed: 175,
		intensity: 0.28,
		maxRadius: PULSE_RADIUS,
		color: stasisColor,
		outlineWidth: 2,
		visualOpacity: 0.72,
	})
	sparkEmitter.emitter.position = position
	sparkEmitter.emit(8)
	k.shake(0.7)
	gameSoundService.playPositional("slowdown", position, {
		volume: mainSoundVolume * 0.55,
		maxDistance: 620,
		detune: -120,
	})
}

function spawnSlowTargetFlash(target: TrapCellTarget) {
	if (!target.exists()) return
	spawnFlash(target.pos, 6, k.rgb(...STASIS_COLOR))
}

function drawSlowdownPlate(cooldown: number, activationFlash: number) {
	const ready = cooldown <= 0
	const flashProgress = k.clamp(
		activationFlash / ACTIVATION_FLASH_DURATION,
		0,
		1
	)
	const pulse = ready ? k.wave(0.32, 0.76, k.time() * 3.5) : 0.16
	const outerColor = flashProgress > 0
		? k.WHITE
		: ready ? k.rgb(205, 215, 220) : k.rgb(65, 76, 84)
	const stasisColor = k.rgb(...STASIS_COLOR)
	const outerPoints = hexPoints(PLATE_RADIUS)
	const innerPoints = hexPoints(8)
	k.drawPolygon({
		pts: outerPoints,
		color: k.rgb(5, 9, 12),
		opacity: 0.9,
	})
	drawHexOutline(outerPoints, outerColor, flashProgress > 0 ? 3 : 2, 0.68)
	drawHexOutline(innerPoints, stasisColor, 2, flashProgress > 0 ? 1 : pulse)

	for (let index = 0; index < 3; index++) {
		const direction = k.Vec2.fromAngle(index * 120 - 90)
		k.drawLine({
			p1: direction.scale(4),
			p2: direction.scale(11),
			width: 2,
			color: flashProgress > 0 ? k.WHITE : stasisColor,
			opacity: flashProgress > 0 ? 1 : pulse,
		})
	}
}

function hexPoints(radius: number) {
	return Array.from({ length: 6 }, (_, index) =>
		k.Vec2.fromAngle(index * 60 + 30).scale(radius)
	)
}

function drawHexOutline(
	points: Vec2[],
	color: ReturnType<typeof k.rgb>,
	width: number,
	opacity: number
) {
	for (let index = 0; index < points.length; index++) {
		k.drawLine({
			p1: points[index],
			p2: points[(index + 1) % points.length],
			width,
			color,
			opacity,
		})
	}
}
