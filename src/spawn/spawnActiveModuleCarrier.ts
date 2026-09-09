import type { Color, GameObj, PosComp, RotateComp, Vec2 } from "kaplay"
import { dt, k, layers, mainSoundVolume } from "../main"
import { explosionEmitter, trailEmitter } from "../particles"
import { gameSoundService } from "../services/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { easeDirection } from "../shared"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common/theme"
import { getCompanionVisual } from "../visuals/companionVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { spawnFlash } from "./spawnFlash"
import { spawnRing } from "./spawnRing"

interface ActiveModuleCarrierProps {
	pos: Vec2
	launchDirection: Vec2
	targetPos: Vec2
	target?: GameObj<PosComp>
	payloadSprite: string
	color: Color
	onArrive: (pos: Vec2) => void
}

interface ActiveModuleCarrierState {
	elapsed: number
	trailElapsed: number
	landed: boolean
	direction: Vec2
}

type ActiveModuleCarrier = GameObj<PosComp | RotateComp> &
	ActiveModuleCarrierState

const CARRIER_SPEED = 280
const CARRIER_STEERING_RESPONSE = 11
const CARRIER_LAUNCH_DURATION = 0.1
const CARRIER_ARRIVAL_RADIUS = 7
const CARRIER_MAX_LIFETIME = 4
const CARRIER_TRAIL_INTERVAL = 0.025
const TARGET_FLASH_INTERVAL = 0.075
const ACTIVE_MODULE_CARRIER_VISUAL = getCompanionVisual("active-module-carrier")

export function spawnActiveModuleCarrier(props: ActiveModuleCarrierProps) {
	const launchDirection = props.launchDirection.len() > 0
		? props.launchDirection.unit()
		: k.vec2(0, -1)
	let targetPos = props.target?.exists()
		? props.target.pos.clone()
		: props.targetPos.clone()
	const launchAngle = k.rad2deg(k.Vec2.toAngle(launchDirection)) + 90
	const targetMarker = props.target
		? undefined
		: spawnCarrierTargetMarker(targetPos)
	const carrier = k.add([
		k.pos(props.pos.clone()),
		k.sprite(requirePrimaryVisualSprite(ACTIVE_MODULE_CARRIER_VISUAL)),
		k.anchor("center"),
		k.rotate(launchAngle),
		k.scale(ACTIVE_MODULE_CARRIER_VISUAL.worldScale),
		k.color(props.color),
		k.layer(layers.gameEffects),
		k.z(6),
		{
			elapsed: 0,
			trailElapsed: 0,
			landed: false,
			direction: launchDirection,
		},
		tags.props,
		tags.gameLoop,
	])
	carrier.onDestroy(() => {
		if (targetMarker?.exists()) k.destroy(targetMarker)
	})

	carrier.add([
		k.sprite(props.payloadSprite),
		k.anchor("center"),
		k.scale(0.32),
		k.color(k.WHITE),
		k.opacity(0.9),
		k.z(1),
	])

	gameSoundService.playPositional("active_module_carrier_launch", carrier.pos, {
		volume: mainSoundVolume * 0.55,
	})

	registerBatchedEntityUpdate("effects", carrier, () => {
		const deltaTime = dt()
		carrier.elapsed += deltaTime
		carrier.trailElapsed += deltaTime
		if (props.target?.exists()) targetPos = props.target.pos.clone()
		if (targetMarker?.exists()) targetMarker.pos = targetPos.clone()

		const toTarget = targetPos.sub(carrier.pos)
		const targetDistance = toTarget.len()
		if (
			carrier.elapsed >= CARRIER_LAUNCH_DURATION &&
			targetDistance <= CARRIER_ARRIVAL_RADIUS
		) {
			landActiveModuleCarrier(carrier, targetPos, props)
			return
		}

		if (
			carrier.elapsed >= CARRIER_LAUNCH_DURATION &&
			targetDistance > 0
		) {
			carrier.direction = easeDirection(
				carrier.direction,
				toTarget.unit(),
				CARRIER_STEERING_RESPONSE,
				deltaTime
			)
		}

		const speed = carrier.elapsed < CARRIER_LAUNCH_DURATION
			? CARRIER_SPEED
			: Math.min(CARRIER_SPEED, Math.max(80, targetDistance * 5))
		const previousPos = carrier.pos.clone()
		const nextPos = carrier.pos.add(
			carrier.direction.scale(speed * deltaTime)
		)
		if (
			carrier.elapsed >= CARRIER_LAUNCH_DURATION &&
			distanceToSegment(targetPos, previousPos, nextPos) <= CARRIER_ARRIVAL_RADIUS
		) {
			landActiveModuleCarrier(carrier, targetPos, props)
			return
		}

		carrier.pos = nextPos
		carrier.angle = k.rad2deg(k.Vec2.toAngle(carrier.direction)) + 90

		if (carrier.trailElapsed >= CARRIER_TRAIL_INTERVAL) {
			carrier.trailElapsed %= CARRIER_TRAIL_INTERVAL
			trailEmitter.emitter.position = carrier.pos.sub(
				carrier.direction.scale(9)
			)
			trailEmitter.emitter.direction = carrier.angle
			trailEmitter.emit(1)
		}

		if (carrier.elapsed >= CARRIER_MAX_LIFETIME) {
			landActiveModuleCarrier(carrier, targetPos, props)
		}
	})

	return carrier
}

function landActiveModuleCarrier(
	carrier: ActiveModuleCarrier,
	targetPos: Vec2,
	props: ActiveModuleCarrierProps
) {
	if (carrier.landed) return
	carrier.landed = true
	carrier.pos = targetPos.clone()
	k.destroy(carrier)
	explosionEmitter.emitter.position = targetPos
	explosionEmitter.emitter.direction = -90
	explosionEmitter.emit(3)
	spawnCarrierSmoke(targetPos)
	spawnFlash(targetPos, 6, props.color)
	spawnRing({
		pos: targetPos,
		speed: 180,
		intensity: 0.12,
		maxRadius: 18,
		color: props.color,
	})
	props.onArrive(targetPos.clone())
}

function spawnCarrierTargetMarker(targetPos: Vec2) {
	const marker = k.add([
		k.pos(targetPos),
		k.sprite("crosshair_precision"),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.opacity(1),
		k.layer(layers.gameEffects),
		k.z(2),
		{ elapsed: 0 },
		tags.props,
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("effects", marker, () => {
		marker.elapsed += dt()
		marker.opacity = Math.floor(
			marker.elapsed / TARGET_FLASH_INTERVAL
		) % 2 === 0 ? 1 : 0
	})
	return marker
}

function spawnCarrierSmoke(pos: Vec2) {
	const smoke = k.add([
		k.pos(pos),
		k.particles(
			{
				max: 12,
				speed: [12, 34],
				acceleration: [k.vec2(-5, -18), k.vec2(5, -34)],
				angle: [0, 360],
				lifeTime: [0.5, 0.85],
				colors: [k.rgb(215, 225, 230), k.rgb(68, 80, 88)],
				opacities: [0.72, 0.48, 0],
				scales: [0.45, 1.25, 1.9],
				angularVelocity: [-80, 80],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 110,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(5),
		tags.props,
		tags.gameLoop,
	])
	smoke.emit(5)
	k.wait(0.9, () => {
		if (smoke.exists()) k.destroy(smoke)
	})
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared === 0) return point.dist(start)
	const progress = k.clamp(point.sub(start).dot(segment) / lengthSquared, 0, 1)
	return point.dist(start.add(segment.scale(progress)))
}
