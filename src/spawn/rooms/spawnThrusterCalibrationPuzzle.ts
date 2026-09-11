import type { GameObj, PosComp, RotateComp, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { snareable, type SnareableComp } from "../../comp/snareable"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { addLocalLight, updateLocalLight } from "../../services/world/localLightService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common"
import { spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import { spawnThrusterPartPickup } from "../spawnThrusterPart"

const SOCKET_OFFSETS = [
	[-68, -48],
	[0, -48],
	[68, -48],
] as const
const VANE_OFFSETS = [
	[-92, 92],
	[0, 118],
	[92, 92],
] as const
const SOCKET_CAPTURE_RADIUS = 23
const SOCKET_MAX_CAPTURE_SPEED = 105
const EXHAUST_PULSE_INTERVAL = 2.35
const EXHAUST_PULSE_FORCE = 125
const CALIBRATION_DURATION = 0.9

interface ThrusterCalibrationPuzzleOptions {
	tags?: string[]
	onCompleted: () => void
}

type CalibrationVane = GameObj<PosComp | RotateComp | SnareableComp> & {
	locked: boolean
}

type CalibrationSocket = GameObj & {
	locked: boolean
	index: number
}

export function spawnThrusterCalibrationPuzzle(
	center: Vec2,
	options: ThrusterCalibrationPuzzleOptions
) {
	let lockedCount = 0
	let pulseTimer = 1.45
	let pulseVisual = 0
	let calibrationElapsed = 0
	let completed = false
	const extraTags = options.tags ?? []
	const rig = spawnCalibrationRig(center, extraTags)
	const sockets = SOCKET_OFFSETS.map((offset, index) =>
		spawnCalibrationSocket(center.add(offset[0], offset[1]), index, extraTags)
	)
	const vanes = VANE_OFFSETS.map((offset, index) =>
		spawnCalibrationVane(center.add(offset[0], offset[1]), index, extraTags)
	)

	const controller = k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(7),
		{
			update() {
				if (completed) return
				pulseVisual = Math.max(0, pulseVisual - k.dt() * 2.4)
				captureNearbyVanes(vanes, sockets, () => {
					lockedCount++
				})

				if (lockedCount >= sockets.length) {
					calibrationElapsed += k.dt()
					rig.status.text = calibrationElapsed < CALIBRATION_DURATION
						? "CALIBRATING"
						: "THRUSTERS SYNCHRONIZED"
					if (calibrationElapsed < CALIBRATION_DURATION) return
					completed = true
					spawnFlash(center.add(0, -24), 24, k.WHITE)
					spawnRing({
						pos: center.add(0, -24),
						speed: 190,
						maxRadius: 82,
						intensity: 0.8,
						color: k.rgb(...UI_COLORS.thrusterPart),
					})
					spawnThrusterPartPickup(center.add(0, -22), {
						objectTags: [tags.runMap],
						forceToTarget: true,
					})
					options.onCompleted()
					return
				}

				pulseTimer -= k.dt()
				if (pulseTimer > 0) return
				pulseTimer = EXHAUST_PULSE_INTERVAL
				pulseVisual = 1
				applyExhaustPulse(center.add(0, -20), vanes)
			},
			draw() {
				if (pulseVisual <= 0) return
				for (let index = 0; index < 3; index++) {
					const x = (index - 1) * 68
					const spread = 24 + (1 - pulseVisual) * 38
					const length = 54 + (1 - pulseVisual) * 58
					const color = k.rgb(...UI_COLORS.accent)
					k.drawLine({
						p1: k.vec2(x, -28),
						p2: k.vec2(x - spread, length),
						width: 2,
						color,
						opacity: pulseVisual * 0.52,
					})
					k.drawLine({
						p1: k.vec2(x, -28),
						p2: k.vec2(x + spread, length),
						width: 2,
						color,
						opacity: pulseVisual * 0.52,
					})
				}
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])

	return { controller, rig: rig.object, sockets, vanes }
}

function spawnCalibrationRig(center: Vec2, extraTags: string[]) {
	const object = k.add([
		k.pos(center.add(0, -82)),
		k.sprite("thruster_calibration_rig", { width: 192, height: 64 }),
		k.anchor("center"),
		k.color(k.WHITE),
		k.layer(layers.game2),
		k.z(1),
		{ groundShadowMode: "ground" as const },
		tags.props,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])
	object.add([
		k.text("EXHAUST ALIGNMENT", {
			font: "unscii",
			size: 8,
			width: 180,
			align: "center",
		}),
		k.pos(0, -8),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
		k.layer(layers.gameText),
	])
	const status = object.add([
		k.text("LASSO VANES INTO CLAMPS", {
			font: "unscii",
			size: 7,
			width: 180,
			align: "center",
		}),
		k.pos(0, 5),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.layer(layers.gameText),
	])
	const glow = addLocalLight(object, {
		size: 105,
		color: UI_COLORS.accent,
		opacity: 0.16,
		pulse: {
			scaleMin: 0.96,
			scaleMax: 1.05,
			scaleSpeed: 2,
			opacityMin: 0.1,
			opacityMax: 0.22,
			opacitySpeed: 2.4,
		},
	})
	registerBatchedEntityUpdate("effects", object, () => updateLocalLight(glow))
	return { object, status }
}

function spawnCalibrationSocket(
	position: Vec2,
	index: number,
	extraTags: string[]
) {
	return k.add([
		k.pos(position),
		k.layer(layers.gameEffects),
		k.z(2),
		{
			locked: false,
			index,
			draw() {
				const color = this.locked
					? k.rgb(...UI_COLORS.thrusterPart)
					: k.rgb(...UI_COLORS.accent)
				k.drawCircle({
					radius: this.locked ? 18 : k.wave(17, 19, k.time() * 3 + index),
					fill: false,
					outline: { width: 2, color },
					opacity: this.locked ? 0.95 : 0.6,
					anchor: "center",
				})
				k.drawRect({
					pos: k.vec2(0, 0),
					width: 8,
					height: 8,
					anchor: "center",
					color,
					opacity: this.locked ? 0.85 : 0.2,
				})
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	]) as CalibrationSocket
}

function spawnCalibrationVane(
	position: Vec2,
	index: number,
	extraTags: string[]
) {
	return k.add([
		k.pos(position),
		k.sprite("thruster_calibration_vane", { width: 24, height: 24 }),
		k.anchor("center"),
		k.rotate(index * 120),
		k.scale(1),
		k.color(...UI_COLORS.thrusterPart),
		k.outline(1, k.rgb(...UI_COLORS.accent)),
		k.layer(layers.game2),
		k.z(4),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		snareable({
			mass: 1.15,
			radius: 12,
			releaseDrag: 2.1,
			angularDrag: 1.5,
		}),
		{
			locked: false,
			draw() {
				k.drawCircle({
					radius: 14,
					fill: false,
					outline: {
						width: 1,
						color: k.rgb(...UI_COLORS.thrusterPart),
					},
					opacity: 0.35,
					anchor: "center",
				})
			},
		},
		tags.props,
		tags.unit,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	]) as CalibrationVane
}

function captureNearbyVanes(
	vanes: CalibrationVane[],
	sockets: CalibrationSocket[],
	onCaptured: () => void
) {
	for (const vane of vanes) {
		if (!vane.exists() || vane.locked || vane.snared) continue
		if (vane.snareVelocity.len() > SOCKET_MAX_CAPTURE_SPEED) continue
		const socket = sockets
			.filter((candidate) => candidate.exists() && !candidate.locked)
			.sort((a, b) => a.pos.dist(vane.pos) - b.pos.dist(vane.pos))[0]
		if (!socket || socket.pos.dist(vane.pos) > SOCKET_CAPTURE_RADIUS) continue
		vane.locked = true
		socket.locked = true
		const capturePosition = socket.pos.clone()
		spawnFlash(capturePosition, 12, k.rgb(...UI_COLORS.thrusterPart))
		spawnRing({
			pos: capturePosition,
			speed: 120,
			maxRadius: 38,
			intensity: 0.45,
			color: k.rgb(...UI_COLORS.accent),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.55,
			detune: 60 + socket.index * 130,
		})
		k.destroy(vane)
		socket.add([
			k.sprite("thruster_calibration_vane", { width: 18, height: 18 }),
			k.anchor("center"),
			k.color(...UI_COLORS.thrusterPart),
			k.layer(layers.game2),
		])
		onCaptured()
	}
}

function applyExhaustPulse(origin: Vec2, vanes: CalibrationVane[]) {
	for (const vane of vanes) {
		if (!vane.exists() || vane.locked || vane.snared) continue
		const away = vane.pos.sub(origin)
		const direction = away.len() > 0.001 ? away.unit() : k.vec2(0, 1)
		vane.snareVelocity = vane.snareVelocity.add(
			direction.scale(EXHAUST_PULSE_FORCE)
		)
	}
	gameSoundService.play("fire_rocket1", {
		volume: mainSoundVolume * 0.42,
		detune: -380,
	})
}
