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
	const plate = k.add([
		k.pos(position),
		k.sprite("wake_slowdown_plate", { frame: 0 }),
		k.anchor("center"),
		k.color(k.WHITE),
		k.layer(layers.game2),
		k.z(-1),
		tags.props,
		tags.roomEnvironment,
		tags.roomTrap,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])

	registerTrapCellTrigger({
		owner: plate,
		position,
		triggerRadius: TRIGGER_RADIUS,
		cooldownSeconds: COOLDOWN_SECONDS,
		activationFlashSeconds: ACTIVATION_FLASH_DURATION,
		onTriggered: (target) => {
			plate.play("trigger", {
				onEnd: () => {
					if (plate.exists()) plate.frame = 0
				},
			})
			activateSlowdownPlate(position, target)
		},
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
