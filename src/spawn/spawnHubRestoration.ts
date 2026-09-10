import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { getHubLevel } from "../services/hub/hubProgressService"
import {
	addLocalLight,
	updateLocalLight,
} from "../services/world/localLightService"
import { tags } from "../tags"
import { getCompanionVisual } from "../visuals/companionVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { applySteeringLean, lerpAngleBetweenPos } from "../shared"

export const HUB_RESTORATION_LAMP_COUNT = 8
const RESTORATION_RING_RADIUS = 235
const HUB_GREEN = [90, 220, 145] as const
const HUB_LAMP_COLOR = [160, 180, 190] as const
const HUB_BROKEN_LAMP_COLOR = [68, 78, 86] as const
const HUB_LAMP_PLATFORM_COLOR = [52, 61, 68] as const
const HUB_LAMP_PLATFORM_SPRITES = [
	"hub_progression_lamp_platform_01",
	"hub_progression_lamp_platform_02",
	"hub_progression_lamp_platform_03",
	"hub_progression_lamp_platform_04",
	"hub_progression_lamp_platform_05",
	"hub_progression_lamp_platform_06",
] as const
const HAULER_SPEED = 145
const HAULER_CARGO_OFFSETS = [[-3, -4], [0, -6], [3, -4], [-1.5, -2], [1.5, -2]] as const

type HaulerPhase = "waiting" | "outbound" | "scavenging" | "returning"

interface HubRestorationOptions {
	initialLampLevel?: number
}

interface HubRestorationLamp {
	object: GameObj
	setLit(lit: boolean): void
}

export interface HubRestorationHandle {
	controller: GameObj
	getLamp(level: number): GameObj | undefined
	setLampLit(level: number, lit: boolean): void
	finishLevelReveal(): void
}

export function spawnHubRestoration(
	center: Vec2,
	phaseStationPos: Vec2,
	hubHalfBounds: Vec2,
	options: HubRestorationOptions = {}
): HubRestorationHandle {
	let spawnedThroughLevel = 0
	let lampLevelOverride = options.initialLampLevel !== undefined
	const lamps = spawnRestorationLamps(
		center,
		options.initialLampLevel ?? getHubLevel()
	)
	const revealThroughLevel = (level: number) => {
		for (let index = 0; index < lamps.length; index++) {
			lamps[index].setLit(index < level)
		}
	}
	const controller = k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(-1),
		{
			update() {
				const level = Math.min(HUB_RESTORATION_LAMP_COUNT, getHubLevel())
				if (!lampLevelOverride) revealThroughLevel(level)
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
	return {
		controller,
		getLamp(level: number) {
			return lamps[level - 1]?.object
		},
		setLampLit(level: number, lit: boolean) {
			lamps[level - 1]?.setLit(lit)
		},
		finishLevelReveal() {
			lampLevelOverride = false
			revealThroughLevel(
				Math.min(HUB_RESTORATION_LAMP_COUNT, getHubLevel())
			)
		},
	}
}

function spawnRestorationLamps(center: Vec2, initialLevel: number) {
	const lamps: HubRestorationLamp[] = []
	for (let index = 0; index < HUB_RESTORATION_LAMP_COUNT; index++) {
		const lampPos = getHubRestorationLampPosition(center, index + 1)
		let lit = index < initialLevel
		k.add([
			k.pos(lampPos.add(0, 22)),
			k.sprite(
				HUB_LAMP_PLATFORM_SPRITES[
					index % HUB_LAMP_PLATFORM_SPRITES.length
				]
			),
			k.anchor("center"),
			k.color(...HUB_LAMP_PLATFORM_COLOR),
			k.layer(layers.game2),
			k.z(-3),
			tags.hubRestoration,
			tags.gameLoop,
		])
		const lamp = k.add([
			k.pos(lampPos),
			k.sprite(
				lit ? "hub_progression_lamp" : "hub_progression_lamp_broken"
			),
			k.anchor("center"),
			k.color(...(lit ? HUB_LAMP_COLOR : HUB_BROKEN_LAMP_COLOR)),
			k.scale(1),
			k.layer(layers.game2),
			k.z(-1),
			tags.hubRestoration,
			tags.gameLoop,
		])
		const light = addLocalLight(lamp, {
			size: 132,
			color: [90, 210, 255],
			opacity: 0,
			pulse: {
				scaleMin: 0.92,
				scaleMax: 1.18,
				scaleSpeed: 3.4,
				opacityMin: 0.72,
				opacityMax: 1,
				opacitySpeed: 2.8,
			},
		})
		const setLit = (nextLit: boolean) => {
			if (lit === nextLit) return
			lit = nextLit
			lamp.use(k.sprite(
				lit ? "hub_progression_lamp" : "hub_progression_lamp_broken"
			))
			lamp.color = k.rgb(...(lit ? HUB_LAMP_COLOR : HUB_BROKEN_LAMP_COLOR))
			light.object.opacity = lit ? 0.82 : 0
			light.object.scale = k.vec2(1)
		}
		lamp.onUpdate(() => {
			if (lit) {
				updateLocalLight(light)
			} else {
				light.object.opacity = 0
				light.object.scale = k.vec2(1)
			}
		})
		lamps.push({ object: lamp, setLit })
	}
	return lamps
}

export function getHubRestorationLampPosition(center: Vec2, lampNumber: number) {
	const index = k.clamp(
		Math.round(lampNumber),
		1,
		HUB_RESTORATION_LAMP_COUNT
	) - 1
	return center.add(
		k.Vec2.fromAngle(-90 + index * 45).scale(RESTORATION_RING_RADIUS)
	).add(0, -10)
}

function spawnRestorationTier(
	center: Vec2,
	phaseStationPos: Vec2,
	hubHalfBounds: Vec2,
	level: number
) {
	switch (level) {
		case 3:
			spawnSalvageHaulers(center, phaseStationPos, hubHalfBounds)
			break
	}
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
		const outsideDestination = outsideDestinations[index]
		const hauler = k.add([
			k.pos(dockPos),
			k.sprite(requirePrimaryVisualSprite(getCompanionVisual("salvager")), { width: 16, height: 16 }),
			k.anchor("center"),
			k.rotate(0),
			k.scale(1),
			k.color(k.WHITE),
			k.opacity(0.92),
			k.layer(layers.game2),
			k.z(-2),
			{
				phase: "waiting" as HaulerPhase,
				phaseTimer: 1.5 + index * 2.3,
				travelStart: dockPos.clone(),
				travelDestination: outsideDestination.clone(),
				travelElapsed: 0,
				travelDuration: 1,
				beginTravel(phase: "outbound" | "returning", destination: Vec2) {
					this.phase = phase
					this.travelStart = this.pos.clone()
					this.travelDestination = destination.clone()
					this.travelElapsed = 0
					this.travelDuration = Math.max(
						0.35,
						this.travelStart.dist(destination) / HAULER_SPEED
					)
				},
				update() {
					if (this.phase === "waiting" || this.phase === "scavenging") {
						this.phaseTimer -= k.dt()
						applySteeringLean(this, this.angle, this.angle)
						if (this.phaseTimer > 0) return
						if (this.phase === "waiting") {
							this.beginTravel("outbound", outsideDestination)
						} else {
							this.beginTravel("returning", dockPos)
						}
						return
					}
					this.travelElapsed += k.dt()
					const progress = k.clamp(
						this.travelElapsed / this.travelDuration,
						0,
						1
					)
					const eased = progress < 0.5
						? 4 * progress * progress * progress
						: 1 - Math.pow(-2 * progress + 2, 3) / 2
					const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
						this.angle,
						this.pos,
						this.travelDestination,
						1 - Math.exp(-6 * k.dt()),
						-90
					)
					this.angle = lerp
					applySteeringLean(this, lerp, correctedDesiredRot)
					this.pos = this.travelStart.lerp(this.travelDestination, eased)

					if (progress >= 1) {
						this.pos = this.travelDestination
						if (this.phase === "outbound") {
							this.phase = "scavenging"
							this.phaseTimer = k.rand(0.45, 0.85)
						} else {
							this.phase = "waiting"
							this.phaseTimer = 2.5 + index * 0.7
							spawnHaulerDepositPulse(dockPos)
						}
					}
				},
			},
			tags.hubRestoration,
			tags.gameLoop,
		])
		const cargo = HAULER_CARGO_OFFSETS.map(([x, y], cargoIndex) =>
			hauler.add([
				k.sprite("particle2"),
				k.pos(x, y),
				k.scale(0.35),
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
