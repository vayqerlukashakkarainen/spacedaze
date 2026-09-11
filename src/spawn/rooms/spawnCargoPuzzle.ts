import type { GameObj, PosComp, RotateComp, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { snareable, type SnareableComp } from "../../comp/snareable"
import { timescale } from "../../comp/timescale"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { addLocalLight, updateLocalLight } from "../../services/world/localLightService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common"
import { spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"

const CARGO_SCALE = 1.35
const CARGO_RADIUS = 17
const SOCKET_RADIUS = 20
const SOCKET_CAPTURE_RADIUS = 24
const SOCKET_MAX_CAPTURE_SPEED = 110

interface CargoPuzzleSpawnOptions {
	tags?: string[]
}

interface CargoSocketSpawnOptions extends CargoPuzzleSpawnOptions {
	activated: boolean
	onActivate: () => boolean
}

type CargoCrate = GameObj<PosComp | RotateComp | SnareableComp> & {
	puzzleId: string
}

export function spawnCargoPuzzleCrate(
	position: Vec2,
	puzzleId: string,
	options: CargoPuzzleSpawnOptions = {}
) {
	const existing = (k.get(tags.cargoPuzzleCrate) as CargoCrate[]).find(
		(crate) => crate.exists() && crate.puzzleId === puzzleId
	)
	if (existing) return existing

	const crate = k.add([
		k.pos(position),
		k.sprite("crate1"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(CARGO_SCALE),
		k.color(k.WHITE),
		k.outline(1, k.rgb(...UI_COLORS.accent)),
		k.layer(layers.game),
		timescale(),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		snareable({
			mass: 2.2,
			radius: CARGO_RADIUS,
			releaseDrag: 2.4,
		}),
		{
			puzzleId,
			hb: CARGO_RADIUS,
		},
		tags.props,
		tags.unit,
		tags.cargoPuzzleCrate,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.tags ?? []),
	]) as CargoCrate
	crate.add([
		k.text("PHASE CARGO", {
			font: "unscii",
			size: 7,
			width: 100,
			align: "center",
		}),
		k.pos(0, -28),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.layer(layers.gameText),
	])
	const glow = addLocalLight(crate, {
		size: 62,
		color: UI_COLORS.accent,
		opacity: 0.28,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.08,
			scaleSpeed: 2.2,
			opacityMin: 0.16,
			opacityMax: 0.32,
			opacitySpeed: 2.6,
		},
	})
	registerBatchedEntityUpdate("effects", crate, () => updateLocalLight(glow))
	return crate
}

export function spawnCargoPuzzleSocket(
	position: Vec2,
	puzzleId: string,
	options: CargoSocketSpawnOptions
) {
	let activated = options.activated
	let completing = false
	const socket = k.add([
		k.pos(position),
		k.scale(1),
		k.opacity(1),
		k.layer(layers.gameEffects),
		k.z(-2),
		{
			hb: 38,
			groundShadowMode: "ground" as const,
			draw() {
				const color = activated
					? k.rgb(...UI_COLORS.success)
					: k.rgb(...UI_COLORS.accent)
				const outerRadius = activated
					? SOCKET_RADIUS
					: k.wave(SOCKET_RADIUS - 1, SOCKET_RADIUS + 1, k.time() * 2.5)
				const outer = Array.from({ length: 6 }, (_, index) =>
					k.Vec2.fromAngle(index * 60 - 90).scale(outerRadius)
				)
				const inner = Array.from({ length: 6 }, (_, index) =>
					k.Vec2.fromAngle(index * 60 - 90).scale(9)
				)
				k.drawLine({
					p1: k.vec2(-25, 0),
					p2: k.vec2(-15, 0),
					width: 3,
					color,
					opacity: activated ? 0.75 : 0.42,
				})
				k.drawPolygon({
					pts: outer,
					color,
					opacity: activated ? 0.2 : 0.08,
					outline: { width: 2, color, opacity: activated ? 1 : 0.72 },
				})
				k.drawPolygon({
					pts: inner,
					color,
					opacity: activated ? 0.7 : 0.16,
					outline: { width: 1, color, opacity: 0.9 },
				})
			},
		},
		tags.props,
		tags.cargoPuzzleSocket,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const receiverBuilding = socket.add([
		k.sprite("cargo_receiver_station"),
		k.pos(-46, 0),
		k.anchor("center"),
		k.scale(1.15),
		k.opacity(activated ? 0.84 : 0.68),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(-1),
	])
	const socketLabel = socket.add([
		k.text(activated ? "DELIVERED" : "DELIVERY", {
			font: "unscii",
			size: 7,
			width: 110,
			align: "center",
		}),
		k.pos(-24, -40),
		k.anchor("center"),
		k.color(...(activated ? UI_COLORS.success : UI_COLORS.accent)),
		k.layer(layers.gameText),
	])
	const glow = addLocalLight(socket, {
		size: 88,
		color: activated ? UI_COLORS.success : UI_COLORS.accent,
		opacity: activated ? 0.38 : 0.22,
	})
	registerBatchedEntityUpdate("world", socket, () => {
		updateLocalLight(glow)
		if (activated || completing) return
		const crate = (k.get(tags.cargoPuzzleCrate) as CargoCrate[]).find(
			(candidate) =>
				candidate.exists() &&
				candidate.puzzleId === puzzleId &&
				candidate.pos.dist(socket.pos) <= SOCKET_CAPTURE_RADIUS
		)
		if (
			!crate ||
			crate.snared ||
			crate.snareVelocity.len() > SOCKET_MAX_CAPTURE_SPEED
		) return
		completing = true
		crate.pos = socket.pos.clone()
		crate.snareVelocity = k.vec2()
		crate.angle = 0
		if (!options.onActivate()) {
			completing = false
			return
		}
		activated = true
		receiverBuilding.opacity = 0.84
		socketLabel.text = "DELIVERED"
		socketLabel.color = k.rgb(...UI_COLORS.success)
		spawnFlash(socket.pos, 18, k.WHITE)
		spawnRing({
			pos: socket.pos,
			speed: 180,
			intensity: 0.5,
			maxRadius: 58,
			color: k.rgb(...UI_COLORS.accent),
		})
		gameSoundService.play("room_cleared", {
			volume: mainSoundVolume * 0.75,
			detune: 180,
		})
		k.wait(0.3, () => {
			if (crate.exists()) k.destroy(crate)
		})
	})
	return socket
}
