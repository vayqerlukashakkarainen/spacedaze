import type { Vec2 } from "kaplay"
import type { RoomEnvironmentObjectPlan } from "../../generation/rooms/roomFloorTypes"
import { hexNeighbor } from "../../grid/hexCoord"
import type { HexGrid } from "../../grid/hexGrid"
import { k, layers, mainSoundVolume } from "../../main"
import { sparkEmitter } from "../../particles"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyKnockbackImpulse } from "../../services/combat/projectileService"
import {
	queryTrapTargets,
	registerTrapCellTrigger,
	type TrapCellTarget,
} from "../../services/world/trapCellService"
import { tags } from "../../tags"
import { spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"

const PLATE_RADIUS = 16
const TRIGGER_RADIUS = 18
const BLAST_RADIUS = 38
const COOLDOWN_SECONDS = 2.4
const KNOCKBACK_DISTANCE = 92
const SNARE_LAUNCH_SPEED = 210
const DEBREE_LAUNCH_SPEED = 145
const BURST_DURATION = 0.18

export function spawnConcussionPlate(
	grid: HexGrid,
	plan: RoomEnvironmentObjectPlan,
	position: Vec2
) {
	const direction = grid.hexToScreen(
		hexNeighbor(plan.coord, plan.orientation % 6)
	).sub(position).unit()
	let triggerController: ReturnType<typeof registerTrapCellTrigger> | undefined
	const plate = k.add([
		k.pos(position),
		k.layer(layers.game2),
		k.z(-1),
		{
			draw() {
				drawPlate(
					direction,
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
		activationFlashSeconds: BURST_DURATION,
		onTriggered: (target) => {
			activateConcussionPlate(position, direction, target)
		},
	})

	return plate
}

function activateConcussionPlate(
	position: Vec2,
	direction: Vec2,
	triggerTarget: TrapCellTarget
) {
	const affected = new Map<number, TrapCellTarget>([[triggerTarget.id, triggerTarget]])
	for (const target of queryTrapTargets(position, BLAST_RADIUS)) {
		affected.set(target.id, target)
	}

	for (const target of affected.values()) launchTrapTarget(target, direction)
	spawnFlash(position, 15, k.WHITE)
	spawnRing({
		pos: position,
		speed: 260,
		intensity: 0.2,
		maxRadius: BLAST_RADIUS,
		color: k.WHITE,
		outlineWidth: 2,
	})
	spawnDirectionalBurst(position, direction)
	sparkEmitter.emitter.position = position.add(direction.scale(8))
	sparkEmitter.emit(10)
	k.shake(1.5)
	gameSoundService.playPositional("hit2", position, {
		volume: mainSoundVolume * 0.65,
		maxDistance: 620,
		detune: -180,
	})
}

function launchTrapTarget(target: TrapCellTarget, direction: Vec2) {
	if (!target.exists()) return
	if (target.is(tags.snareable) && target.releaseSnare) {
		const mass = Math.max(0.25, target.snareMass ?? 1)
		target.releaseSnare(direction.scale(SNARE_LAUNCH_SPEED / mass))
	}
	if (target.is(tags.projectile) && target.dir) {
		target.dir = direction.clone()
	}
	if (target.is(tags.debree)) {
		target.dir = direction.clone()
		target.speed = Math.max(target.speed ?? 0, DEBREE_LAUNCH_SPEED)
		target.lifeSpan = 0
	}
	if (target.moveDirection) target.moveDirection = direction.clone()
	applyKnockbackImpulse(target, direction, KNOCKBACK_DISTANCE)
}

function drawPlate(
	direction: Vec2,
	cooldown: number,
	activationFlash: number
) {
	const ready = cooldown <= 0
	const warningPulse = ready ? k.wave(0.38, 0.72, k.time() * 4.5) : 0.18
	const flashProgress = k.clamp(activationFlash / BURST_DURATION, 0, 1)
	const edgeColor = flashProgress > 0
		? k.WHITE
		: ready ? k.rgb(210, 210, 210) : k.rgb(70, 78, 84)
	const points = Array.from({ length: 6 }, (_, index) =>
		k.Vec2.fromAngle(index * 60 + 30).scale(PLATE_RADIUS)
	)
	k.drawPolygon({
		pts: points,
		color: k.rgb(5, 9, 12),
		opacity: 0.9,
	})
	for (let index = 0; index < points.length; index++) {
		k.drawLine({
			p1: points[index],
			p2: points[(index + 1) % points.length],
			width: flashProgress > 0 ? 3 : 2,
			color: edgeColor,
			opacity: flashProgress > 0 ? 1 : 0.68,
		})
	}
	const tangent = k.vec2(-direction.y, direction.x)
	const arrowTip = direction.scale(10)
	const arrowTail = direction.scale(-8)
	k.drawLine({
		p1: arrowTail,
		p2: arrowTip,
		width: 3,
		color: ready ? k.rgb(255, 70, 70) : edgeColor,
		opacity: flashProgress > 0 ? 1 : warningPulse,
	})
	k.drawLine({
		p1: arrowTip,
		p2: direction.scale(4).add(tangent.scale(5)),
		width: 2,
		color: edgeColor,
		opacity: ready ? 0.9 : 0.28,
	})
	k.drawLine({
		p1: arrowTip,
		p2: direction.scale(4).sub(tangent.scale(5)),
		width: 2,
		color: edgeColor,
		opacity: ready ? 0.9 : 0.28,
	})
}

function spawnDirectionalBurst(position: Vec2, direction: Vec2) {
	const burst = k.add([
		k.pos(position),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			update() {
				this.elapsed += k.dt()
				if (this.elapsed >= BURST_DURATION) k.destroy(this)
			},
			draw() {
				const progress = k.clamp(this.elapsed / BURST_DURATION, 0, 1)
				const tangent = k.vec2(-direction.y, direction.x)
				k.drawPolygon({
					pts: [
						direction.scale(5).add(tangent.scale(10)),
						direction.scale(20 + progress * 42),
						direction.scale(5).sub(tangent.scale(10)),
					],
					color: k.WHITE,
					opacity: 0.6 * (1 - progress),
				})
			},
		},
		tags.gameLoop,
		tags.runMap,
		tags.runRoom,
	])
	return burst
}
