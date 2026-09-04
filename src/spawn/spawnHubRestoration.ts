import type { Vec2 } from "kaplay"
import { k, layers } from "../main"
import { getHubLevel } from "../services/hubProgressService"
import {
	addLocalLight,
	updateLocalLight,
} from "../services/localLightService"
import { tags } from "../tags"

const RESTORATION_TIER_COUNT = 8
const RESTORATION_RING_RADIUS = 235
const HUB_CYAN = [0, 207, 255] as const
const HUB_GREEN = [90, 220, 145] as const
const HUB_LAMP_COLOR = [160, 180, 190] as const
const HUB_BROKEN_LAMP_COLOR = [68, 78, 86] as const
const HUB_LAMP_PLATFORM_COLOR = [52, 61, 68] as const
const HAULER_SPEED = 145
const HAULER_DEBRIS_COUNT = 3

type HaulerPhase = "waiting" | "outbound" | "returning"

export function spawnHubRestoration(
	center: Vec2,
	phaseStationPos: Vec2,
	hubHalfBounds: Vec2
) {
	let spawnedThroughLevel = 0
	spawnRestorationLamps(center)
	const controller = k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(-1),
		{
			update() {
				const level = Math.min(RESTORATION_TIER_COUNT, getHubLevel())
				while (spawnedThroughLevel < level) {
					spawnedThroughLevel++
					spawnRestorationTier(
						center,
						phaseStationPos,
						hubHalfBounds,
						spawnedThroughLevel
					)
				}
			},
		},
		tags.hubRestoration,
		tags.gameLoop,
	])
	controller.update()
	return controller
}

function spawnRestorationLamps(center: Vec2) {
	for (let index = 0; index < RESTORATION_TIER_COUNT; index++) {
		const pos = center.add(
			k.Vec2.fromAngle(-90 + index * 45).scale(RESTORATION_RING_RADIUS)
		)
		let reached: boolean | undefined
		k.add([
			k.pos(pos.add(0, 12)),
			k.sprite("hub_progression_lamp_rock"),
			k.anchor("center"),
			k.color(...HUB_LAMP_PLATFORM_COLOR),
			k.layer(layers.game2),
			k.z(-3),
			tags.hubRestoration,
			tags.gameLoop,
		])
		const lamp = k.add([
			k.pos(pos.add(0, -10)),
			k.sprite("hub_progression_lamp_broken"),
			k.anchor("center"),
			k.color(...HUB_BROKEN_LAMP_COLOR),
			k.scale(1),
			k.layer(layers.game2),
			k.z(-1),
			tags.hubRestoration,
			tags.gameLoop,
		])
		const light = addLocalLight(lamp, {
			size: 74,
			color: [70, 180, 255],
			opacity: 0,
			z: 2,
			pulse: {
				scaleMin: 0.9,
				scaleMax: 1.12,
				scaleSpeed: 3.4,
				opacityMin: 0.52,
				opacityMax: 0.76,
				opacitySpeed: 2.8,
			},
		})
		lamp.onUpdate(() => {
			const activeLevel = Math.min(RESTORATION_TIER_COUNT, getHubLevel())
			const nextReached = index < activeLevel
			if (reached !== nextReached) {
				reached = nextReached
				lamp.use(k.sprite(
					reached
						? "hub_progression_lamp"
						: "hub_progression_lamp_broken"
				))
				lamp.color = k.rgb(...(
					reached ? HUB_LAMP_COLOR : HUB_BROKEN_LAMP_COLOR
				))
			}
			if (reached) {
				updateLocalLight(light)
			} else {
				light.object.opacity = 0
				light.object.scale = k.vec2(1)
			}
		})
	}
}

function spawnRestorationTier(
	center: Vec2,
	phaseStationPos: Vec2,
	hubHalfBounds: Vec2,
	level: number
) {
	switch (level) {
		case 1:
			spawnMaintenanceDrone(center, 150, 82, 0.18, 0, "room_convoy_drone")
			break
		case 2:
			spawnMaintenanceDrone(center, 205, 116, -0.15, 0.38, "drone_combat")
			break
		case 3:
			spawnSalvageHaulers(center, phaseStationPos, hubHalfBounds)
			break
		case 4:
			spawnSignalArray(center.add(-330, 120))
			break
		case 5:
			spawnMaintenanceDrone(center, 300, 176, 0.13, 0.67, "drone_salvager")
			spawnMaintenanceDrone(center, 326, 190, -0.11, 0.12, "drone_medic")
			break
		case 6:
			spawnDockingGantries(center)
			break
		case 7:
			spawnTrafficGrid(center)
			spawnMaintenanceDrone(center, 430, 245, 0.1, 0.2, "drone_interceptor")
			spawnMaintenanceDrone(center, 460, 270, -0.085, 0.72, "drone_gunship")
			break
		case 8:
			spawnPhaseCrown(center)
			break
	}
}

function spawnMaintenanceDrone(
	center: Vec2,
	radiusX: number,
	radiusY: number,
	speed: number,
	phase: number,
	sprite: string
) {
	const drone = k.add([
		k.pos(center),
		k.sprite(sprite, { width: 28, height: 28 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(205, 240, 245),
		k.opacity(0.94),
		k.layer(layers.game2),
		k.z(-2),
		{
			update() {
				const angle = (k.time() * speed + phase) * Math.PI * 2
				const nextAngle = angle + Math.sign(speed) * 0.02
				const nextPos = center.add(
					Math.cos(nextAngle) * radiusX,
					Math.sin(nextAngle) * radiusY
				)
				this.pos = center.add(
					Math.cos(angle) * radiusX,
					Math.sin(angle) * radiusY
				)
				const direction = nextPos.sub(this.pos)
				this.angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI + 90
			},
		},
		tags.hubRestoration,
		tags.gameLoop,
	])
	drone.add([
		k.circle(12),
		k.anchor("center"),
		k.color(...HUB_CYAN),
		k.opacity(0.16),
		k.z(-1),
	])
}

function spawnSalvageHaulers(
	center: Vec2,
	phaseStationPos: Vec2,
	hubHalfBounds: Vec2
) {
	const outsideMargin = 180
	const outsideDestinations = [
		center.add(-hubHalfBounds.x - outsideMargin, -hubHalfBounds.y * 0.72),
		center.add(0, -hubHalfBounds.y - outsideMargin),
		center.add(hubHalfBounds.x + outsideMargin, -hubHalfBounds.y * 0.55),
	]
	const dockingOffsets = [
		k.vec2(-42, 36),
		k.vec2(0, 48),
		k.vec2(42, 36),
	]
	for (let index = 0; index < outsideDestinations.length; index++) {
		const dockPos = phaseStationPos.add(dockingOffsets[index])
		const hauler = k.add([
			k.pos(dockPos),
			k.sprite("hub_salvage_hauler"),
			k.anchor("center"),
			k.rotate(0),
			k.color(k.WHITE),
			k.opacity(0.92),
			k.layer(layers.game2),
			k.z(-2),
			{
				phase: "waiting" as HaulerPhase,
				phaseTimer: 1.5 + index * 2.3,
				update() {
					if (this.phase === "waiting") {
						this.phaseTimer -= k.dt()
						if (this.phaseTimer <= 0) this.phase = "outbound"
						return
					}
					const destination = this.phase === "outbound"
						? outsideDestinations[index]
						: dockPos
					const toDestination = destination.sub(this.pos)
					const distance = toDestination.len()
					if (distance <= 3) {
						this.pos = destination
						if (this.phase === "outbound") {
							this.phase = "returning"
						} else {
							this.phase = "waiting"
							this.phaseTimer = 2.5 + index * 0.7
							spawnHaulerDepositPulse(dockPos)
						}
						return
					}
					const direction = toDestination.scale(1 / distance)
					this.pos = this.pos.add(
						direction.scale(Math.min(distance, HAULER_SPEED * k.dt()))
					)
					this.angle = direction.angle() + 90
				},
			},
			tags.hubRestoration,
			tags.gameLoop,
		])
		const cargo = Array.from({ length: HAULER_DEBRIS_COUNT }, (_, cargoIndex) =>
			hauler.add([
				k.sprite("debree_part1"),
				k.pos((cargoIndex % 2 === 0 ? -1 : 1) * 3, 11 + cargoIndex * 8),
				k.anchor("center"),
				k.rotate(cargoIndex * 67),
				k.color(150, 170, 176),
				k.opacity(0),
				k.z(-1),
			])
		)
		hauler.onUpdate(() => {
			const carrying = hauler.phase === "returning"
			for (const piece of cargo) {
				piece.opacity = carrying ? 0.88 : 0
				piece.angle += k.dt() * 32
			}
		})
	}
}

function spawnHaulerDepositPulse(pos: Vec2) {
	k.add([
		k.pos(pos),
		k.circle(5, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(...HUB_GREEN)),
		k.opacity(0.75),
		k.scale(1),
		k.lifespan(0.45, { fade: 0.25 }),
		k.layer(layers.gameEffects),
		k.z(-1),
		tags.hubRestoration,
		tags.gameLoop,
	])
}

function spawnSignalArray(center: Vec2) {
	for (let index = 0; index < 3; index++) {
		const angle = -90 + index * 120
		const node = k.add([
			k.pos(center.add(k.Vec2.fromAngle(angle).scale(72))),
			k.sprite("room_signal_relay", { width: 42, height: 42 }),
			k.anchor("center"),
			k.rotate(angle),
			k.color(135, 210, 230),
			k.opacity(0.84),
			k.layer(layers.buildings),
			k.z(-2),
			{
				update() {
					this.opacity = k.wave(0.62, 0.94, k.time() * 2.2 + index)
				},
			},
			tags.hubRestoration,
			tags.gameLoop,
		])
		node.add([
			k.circle(22, { fill: false }),
			k.anchor("center"),
			k.outline(1, k.rgb(...HUB_CYAN)),
			k.opacity(0.28),
			k.z(-1),
		])
	}
}

function spawnDockingGantries(center: Vec2) {
	for (const pos of [center.add(-190, 165), center.add(190, 165)]) {
		const pad = k.add([
			k.pos(pos),
			k.rect(82, 38, { fill: false }),
			k.anchor("center"),
			k.outline(1, k.rgb(...HUB_GREEN)),
			k.opacity(0.68),
			k.layer(layers.gameEffects),
			k.z(-2),
			tags.hubRestoration,
			tags.gameLoop,
		])
		pad.add([
			k.rect(62, 2),
			k.anchor("center"),
			k.color(...HUB_GREEN),
			k.opacity(0.55),
		])
	}
}

function spawnTrafficGrid(center: Vec2) {
	k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(-3),
		{
			draw() {
				for (let lane = 0; lane < 2; lane++) {
					const radius = 350 + lane * 36
					for (let index = 0; index < 24; index++) {
						if ((index + Math.floor(k.time() * 3)) % 4 !== 0) continue
						const start = -90 + index * 15
						k.drawLine({
							p1: k.Vec2.fromAngle(start).scale(radius),
							p2: k.Vec2.fromAngle(start + 7).scale(radius),
							width: 1,
							color: k.rgb(...HUB_CYAN),
							opacity: 0.28,
						})
					}
				}
			},
		},
		tags.hubRestoration,
		tags.gameLoop,
	])
}

function spawnPhaseCrown(center: Vec2) {
	k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(-1),
		{
			draw() {
				const pulse = k.wave(0.88, 1.12, k.time() * 2.4)
				for (const radius of [92, 112]) {
					k.drawCircle({
						pos: k.vec2(0),
						radius: radius * pulse,
						fill: false,
						outline: {
							width: 2,
							color: k.rgb(...HUB_GREEN),
							opacity: radius === 92 ? 0.62 : 0.34,
						},
						anchor: "center",
					})
				}
			},
		},
		tags.hubRestoration,
		tags.gameLoop,
	])
}
