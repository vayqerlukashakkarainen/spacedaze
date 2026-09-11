import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../../main"
import { boostTrailEmitter } from "../../particles"
import { PLAYER_SCALE } from "../../player"
import { spawnFlash } from "../../spawn/spawnFlash"
import { spawnGravityPull } from "../../spawn/spawnGravityPull"
import { spawnRing } from "../../spawn/spawnRing"
import { tags } from "../../tags"
import { PLAYER_DIRECTIONAL_SPRITES } from "../../visuals/playerVisualCatalog"
import { gameSoundService } from "../audio/gameSoundService"
import {
	consumePersistentShipPart,
	queryPersistentShipParts,
	spawnPersistentShipPart,
	type PersistentShipPartRecord,
} from "../combat/persistentShipPartService"
import { createExplosion } from "../combat/explosionService"
import {
	applyKnockbackImpulse,
	spawnProjectile,
} from "../combat/projectileService"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import {
	findClosestSpatial,
	forEachSpatialNearby,
} from "../core/runtimeSpatialIndexService"
import { getAbilityTierValues } from "./abilityTierService"

const GHOST_RECORDING_DURATION = 4
const GHOST_SAMPLE_INTERVAL = 0.05
const GHOST_FLEET_OFFSETS = [
	[-34, 24],
	[34, 24],
	[0, 52],
] as const
const SCRAP_COLOSSUS_PROJECTILE_TURN_SPEED = 0.075
const SCRAP_COLOSSUS_FINALE_SPOOL_DURATION = 0.9
const SCRAP_COLOSSUS_FINALE_SPEED = 920
const SCRAP_COLOSSUS_FINALE_MAX_DURATION = 1.4
const SCRAP_COLOSSUS_FINALE_TARGET_RANGE = 900

interface GhostSample {
	time: number
	position: Vec2
	angle: number
}

interface GhostShot {
	time: number
	direction: Vec2
	rotation: number
	chargeRatio: number
}

interface GhostRecording {
	controller: GameObj
	player: PlayerUltimateSource
	elapsed: number
	nextSampleAt: number
	samples: GhostSample[]
	shots: GhostShot[]
}

type PlayerUltimateSource = GameObj<PosComp> & {
	angle?: number
}

let ghostRecording: GhostRecording | undefined

export function activateGravitonCollapse(playerObj: PlayerUltimateSource) {
	const target = k.toWorld(k.mousePos())
	const tier = getAbilityTierValues("gravitonCollapse")
	const radius = 230 * tier.speed
	const duration = 2.1
	const gravity = spawnGravityPull({
		pos: target,
		radius,
		strength: 94 * tier.power,
		falloff: 0.72,
		targetTags: [
			tags.enemy,
			tags.projectile,
			tags.debree,
			tags.persistentShipPart,
			tags.roomCover,
			tags.roomVolatile,
		],
		tagStrengthMultipliers: {
			[tags.projectile]: 1.8,
			[tags.debree]: 1.45,
			[tags.persistentShipPart]: 1.45,
		},
		visualizePull: true,
		tags: [tags.runRoom, tags.runMap],
	})
	const core = k.add([
		k.pos(target),
		k.opacity(1),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / duration, 0, 1)
				const pulse = k.wave(0.72, 1, k.time() * (8 + progress * 12))
				for (let index = 0; index < 4; index++) {
					const angle = k.time() * 100 + index * 90
					const outer = k.Vec2.fromAngle(angle).scale(32 + 38 * (1 - progress))
					const inner = k.Vec2.fromAngle(angle + 18).scale(12)
					k.drawLine({
						p1: outer,
						p2: inner,
						width: 2,
						color: k.rgb(190, 95, 255),
						opacity: 0.35 + progress * 0.6,
					})
				}
				k.drawCircle({
					radius: (10 + progress * 13) * pulse,
					color: k.BLACK,
					outline: { width: 3, color: k.WHITE },
				})
				k.drawCircle({
					radius: 4 + progress * 4,
					color: k.rgb(210, 145, 255),
				})
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("effects", core, () => {
		core.elapsed += k.dt()
		if (core.elapsed < duration) {
			if (Math.floor(core.elapsed * 8) !== Math.floor((core.elapsed - k.dt()) * 8)) {
				k.shake(k.lerp(0.25, 1.8, core.elapsed / duration))
			}
			return
		}
		if (gravity.exists()) k.destroy(gravity)
		collapseGravitonCore(target, radius, tier.power)
		k.destroy(core)
	})
	spawnRing({
		pos: target,
		speed: 115,
		intensity: 0.7,
		maxRadius: radius * 0.62,
		color: k.rgb(195, 100, 255),
		visualOpacity: 0.55,
	})
	gameSoundService.playPositional("high_rarity_reveal", target, {
		volume: mainSoundVolume * 0.8,
		detune: -520,
	})
}

function collapseGravitonCore(pos: Vec2, radius: number, power: number) {
	forEachSpatialNearby(pos, radius * 1.25, {
		anyTags: [
			tags.enemy,
			tags.debree,
			tags.persistentShipPart,
			tags.roomCover,
			tags.roomVolatile,
		],
	}, (target) => {
		const direction = target.pos.sub(pos)
		if (direction.len() <= 0.001) return
		applyKnockbackImpulse(target, direction, 125 * power)
	})
	spawnFlash(pos, 52, k.WHITE)
	spawnRing({
		pos,
		speed: 720,
		intensity: 1.35,
		maxRadius: radius * 1.25,
		color: k.rgb(220, 170, 255),
		visualOpacity: 0.95,
		outlineWidth: 5,
	})
	createExplosion({
		pos,
		radius,
		damage: 58 * power,
		combatCredit: {
			kind: "ultimate",
			id: "gravitonCollapse",
			explosive: true,
		},
		visualIntensity: 1.8,
		visualParticleCount: 96,
		damageFalloff: 0.3,
		falloffDistance: 135,
	})
	gameSoundService.playPositional("explosion2", pos, {
		volume: mainSoundVolume,
		detune: -260,
	})
	k.flash(k.WHITE, 0.13)
	k.shake(20)
}

export function activateGhostFleet(playerObj: PlayerUltimateSource) {
	if (ghostRecording?.controller.exists()) k.destroy(ghostRecording.controller)
	const controller = k.add([
		k.pos(),
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	ghostRecording = {
		controller,
		player: playerObj,
		elapsed: 0,
		nextSampleAt: 0,
		samples: [],
		shots: [],
	}
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 190,
		intensity: 0.45,
		maxRadius: 105,
		color: k.rgb(80, 220, 255),
		visualOpacity: 0.75,
	})
	gameSoundService.play("swap_level", {
		volume: mainSoundVolume * 0.75,
		detune: 420,
	})
	registerBatchedEntityUpdate("effects", controller, () => {
		const recording = ghostRecording
		if (!recording || recording.controller.id !== controller.id) return
		if (!playerObj.exists()) {
			ghostRecording = undefined
			k.destroy(controller)
			return
		}
		recording.elapsed += k.dt()
		if (recording.elapsed >= recording.nextSampleAt) {
			recording.samples.push({
				time: recording.elapsed,
				position: playerObj.pos.clone(),
				angle: playerObj.angle ?? 0,
			})
			recording.nextSampleAt += GHOST_SAMPLE_INTERVAL
			spawnGhostRecordSpark(playerObj.pos, recording.elapsed)
		}
		if (recording.elapsed < GHOST_RECORDING_DURATION) return
		ghostRecording = undefined
		k.destroy(controller)
		spawnGhostFleetReplay(recording)
	})
}

export function recordGhostFleetShot(
	direction: Vec2,
	rotation: number,
	chargeRatio: number
) {
	if (!ghostRecording) return
	ghostRecording.shots.push({
		time: ghostRecording.elapsed,
		direction: direction.clone(),
		rotation,
		chargeRatio,
	})
}

function spawnGhostRecordSpark(pos: Vec2, elapsed: number) {
	if (Math.floor(elapsed * 10) % 3 !== 0) return
	k.add([
		k.pos(pos),
		k.circle(2),
		k.color(80, 220, 255),
		k.opacity(0.5),
		k.lifespan(0.45, { fade: 0.35 }),
		k.layer(layers.gameEffects),
		tags.gameLoop,
	])
}

function spawnGhostFleetReplay(recording: GhostRecording) {
	if (recording.samples.length === 0) return
	const tier = getAbilityTierValues("ghostFleet")
	const replayDuration = GHOST_RECORDING_DURATION / tier.speed
	const echoes = GHOST_FLEET_OFFSETS.map((offset, index) => {
		const vectorOffset = k.vec2(offset[0], offset[1])
		const echo = k.add([
			k.pos(recording.samples[0].position.add(vectorOffset)),
			k.sprite(PLAYER_DIRECTIONAL_SPRITES[0]),
			k.anchor("center"),
			k.rotate(recording.samples[0].angle),
			k.scale(PLAYER_SCALE * 0.82),
			k.color(65 + index * 15, 190, 255),
			k.opacity(0.42),
			k.layer(layers.gameEffects),
			tags.runRoom,
			tags.runMap,
			tags.gameLoop,
		])
		return { echo, offset: vectorOffset }
	})
	const controller = k.add([
		k.pos(),
		{ elapsed: 0, sampleIndex: 0, shotIndex: 0 },
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	spawnFlash(recording.samples[0].position, 26, k.rgb(100, 220, 255))
	k.flash(k.rgb(170, 240, 255), 0.08)
	k.shake(6)
	gameSoundService.play("high_rarity_reveal", {
		volume: mainSoundVolume,
		detune: 680,
	})
	registerBatchedEntityUpdate("effects", controller, () => {
		controller.elapsed += k.dt()
		const sourceTime = controller.elapsed * tier.speed
		while (
			controller.sampleIndex + 1 < recording.samples.length &&
			recording.samples[controller.sampleIndex + 1].time <= sourceTime
		) controller.sampleIndex++
		const sample = recording.samples[controller.sampleIndex]
		for (const { echo, offset } of echoes) {
			if (!echo.exists()) continue
			echo.pos = sample.position.add(rotateOffset(offset, sample.angle))
			echo.angle = sample.angle
			echo.opacity = k.wave(0.28, 0.58, k.time() * 12)
		}
		while (
			controller.shotIndex < recording.shots.length &&
			recording.shots[controller.shotIndex].time <= sourceTime
		) {
			const shot = recording.shots[controller.shotIndex++]
			for (const { echo } of echoes) {
				if (echo.exists()) spawnGhostShot(echo.pos, shot, tier.power)
			}
		}
		if (controller.elapsed < replayDuration) return
		for (const { echo } of echoes) {
			if (!echo.exists()) continue
			spawnFlash(echo.pos, 12, k.rgb(80, 220, 255))
			k.destroy(echo)
		}
		spawnRing({
			pos: sample.position,
			speed: 260,
			intensity: 0.4,
			maxRadius: 110,
			color: k.rgb(80, 220, 255),
		})
		k.shake(4)
		k.destroy(controller)
	})
}

function spawnGhostShot(pos: Vec2, shot: GhostShot, power: number) {
	spawnProjectile({
		pos: pos.clone(),
		dir: shot.direction,
		rotation: shot.rotation,
		sprite: "particle3",
		tint: k.rgb(85, 220, 255),
		effectTint: k.rgb(85, 220, 255),
		visualScale: 0.62 + shot.chargeRatio * 0.28,
		visualLengthScale: 2.2,
		speed: 390,
		tags: [tags.friendly, tags.blaster],
		impact: { damage: (4 + shot.chargeRatio * 3) * power },
		piercing: { maxPierces: 1 },
		lifespan: { duration: 2.8 },
		combatCredit: { kind: "ultimate", id: "ghostFleet" },
	})
}

function rotateOffset(offset: Vec2, angle: number) {
	const radians = angle * Math.PI / 180
	return k.vec2(
		offset.x * Math.cos(radians) - offset.y * Math.sin(radians),
		offset.x * Math.sin(radians) + offset.y * Math.cos(radians)
	)
}

export function activateScrapColossus(playerObj: PlayerUltimateSource) {
	const tier = getAbilityTierValues("scrapColossus")
	const records = queryPersistentShipParts(playerObj.pos, 420).slice(0, 12)
	const consumed = records.flatMap((record) => {
		const part = consumePersistentShipPart(record.id)
		return part ? [{ ...part, position: part.position.clone() }] : []
	})
	const duration = (8 + consumed.length * 0.28) * tier.speed
	const colossus = k.add([
		k.pos(playerObj.pos.add(0, 74)),
		k.sprite("ultimate_scrap_colossus"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(2.15),
		k.color(k.WHITE),
		k.opacity(0),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			fireTimer: 0.35,
			finalePhase: "active" as "active" | "spooling" | "charging",
			finaleElapsed: 0,
			thrusterTimer: 0,
			chargeDirection: k.vec2(0, -1),
			chargeTarget: undefined as GameObj<PosComp> | undefined,
		},
		tags.friendly,
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	for (const [index, record] of consumed.entries()) {
		const side = index % 2 === 0 ? -1 : 1
		const row = Math.floor(index / 2)
		colossus.add([
			k.sprite(record.sprite),
			k.pos(side * (13 + row * 2.5), 2 + row * 5),
			k.anchor("center"),
			k.rotate(record.angle),
			k.scale(Math.max(0.22, record.scale * 0.52)),
			k.color(index % 3 === 0 ? k.rgb(110, 225, 255) : k.WHITE),
			k.opacity(0.78),
		])
	}
	for (const record of consumed) {
		spawnAssemblyStreak(record.position, colossus)
	}
	spawnFlash(playerObj.pos, 34, k.WHITE)
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 340,
		intensity: 0.8,
		maxRadius: 170,
		color: k.WHITE,
		visualOpacity: 0.8,
	})
	gameSoundService.play("lasso_throw", {
		volume: mainSoundVolume,
		detune: -380,
	})
	k.shake(9)
	registerBatchedEntityUpdate("world", colossus, () => {
		if (!playerObj.exists()) {
			k.destroy(colossus)
			return
		}
		colossus.elapsed += k.dt()
		colossus.opacity = k.clamp(colossus.elapsed / 0.45, 0, 0.96)
		if (colossus.finalePhase === "active") {
			colossus.fireTimer -= k.dt()
			const desired = playerObj.pos.add(
				rotateOffset(k.vec2(0, 78), playerObj.angle ?? 0)
			)
			colossus.pos = colossus.pos.lerp(
				desired,
				1 - Math.pow(0.002, k.dt())
			)
			colossus.angle = playerObj.angle ?? 0
			if (colossus.fireTimer <= 0) {
				colossus.fireTimer = 0.48 / tier.speed
				fireColossusVolley(colossus, consumed.length, tier.power)
			}
			if (colossus.elapsed < duration) return
			const target = findClosestSpatial(
				colossus.pos,
				SCRAP_COLOSSUS_FINALE_TARGET_RANGE,
				{ allTags: [tags.enemy, tags.unit] }
			)
			if (!target) {
				disassembleColossus(colossus.pos, consumed)
				k.destroy(colossus)
				return
			}
			colossus.finalePhase = "spooling"
			colossus.finaleElapsed = 0
			colossus.chargeTarget = target
			colossus.chargeDirection = target.pos.sub(colossus.pos).unit()
			gameSoundService.playPositional("player_primary_charge", colossus.pos, {
				volume: mainSoundVolume * 0.8,
				detune: -420,
			})
			spawnRing({
				pos: colossus.pos.clone(),
				speed: 110,
				intensity: 0.5,
				maxRadius: 52,
				color: k.rgb(80, 190, 255),
				visualOpacity: 0.7,
			})
			return
		}

		colossus.finaleElapsed += k.dt()
		const liveTarget = colossus.chargeTarget?.exists()
			? colossus.chargeTarget
			: findClosestSpatial(
				colossus.pos,
				SCRAP_COLOSSUS_FINALE_TARGET_RANGE,
				{ allTags: [tags.enemy, tags.unit] }
			)
		if (liveTarget) {
			colossus.chargeTarget = liveTarget
			const targetDirection = liveTarget.pos.sub(colossus.pos)
			if (targetDirection.len() > 0) {
				colossus.chargeDirection = colossus.chargeDirection.lerp(
					targetDirection.unit(),
					colossus.finalePhase === "spooling" ? 0.18 : 0.07
				).unit()
			}
		}
		colossus.angle = colossus.chargeDirection.angle() + 90
		colossus.thrusterTimer -= k.dt()
		if (colossus.thrusterTimer <= 0) {
			colossus.thrusterTimer = colossus.finalePhase === "spooling" ? 0.055 : 0.025
			emitColossusThrusters(
				colossus.pos,
				colossus.chargeDirection,
				colossus.finalePhase === "spooling" ? 2 : 4
			)
		}

		if (colossus.finalePhase === "spooling") {
			const spoolProgress = k.clamp(
				colossus.finaleElapsed / SCRAP_COLOSSUS_FINALE_SPOOL_DURATION,
				0,
				1
			)
			colossus.scale = k.vec2(2.15 + k.wave(0, 0.08, k.time() * 18) * spoolProgress)
			if (spoolProgress < 1) return
			colossus.finalePhase = "charging"
			colossus.finaleElapsed = 0
			gameSoundService.playPositional("rammer_launch", colossus.pos, {
				volume: mainSoundVolume,
				detune: -260,
			})
			spawnFlash(colossus.pos, 24, k.rgb(100, 210, 255))
			k.shake(7)
			return
		}

		const previousPos = colossus.pos.clone()
		colossus.pos = colossus.pos.add(
			colossus.chargeDirection.scale(SCRAP_COLOSSUS_FINALE_SPEED * k.dt())
		)
		const targetPos = liveTarget?.pos
		const struckTarget = targetPos !== undefined &&
			distanceToSegment(targetPos, previousPos, colossus.pos) <= 30
		if (!struckTarget && colossus.finaleElapsed < SCRAP_COLOSSUS_FINALE_MAX_DURATION) {
			return
		}
		finishColossusCharge(
			struckTarget && targetPos ? targetPos : colossus.pos,
			colossus.chargeDirection,
			consumed,
			tier.power
		)
		k.destroy(colossus)
	})
	return colossus
}

function emitColossusThrusters(pos: Vec2, direction: Vec2, amount: number) {
	const side = k.vec2(-direction.y, direction.x)
	for (const offset of [-8, 8]) {
		boostTrailEmitter.emitter.position = pos
			.sub(direction.scale(24))
			.add(side.scale(offset))
		boostTrailEmitter.emitter.direction = direction.scale(-1).angle()
		boostTrailEmitter.emit(amount)
	}
}

function finishColossusCharge(
	pos: Vec2,
	direction: Vec2,
	records: PersistentShipPartRecord[],
	power: number
) {
	const explosion = createExplosion({
		pos: pos.clone(),
		radius: 125,
		damage: (95 + records.length * 7) * power,
		canCrit: false,
		combatCredit: {
			kind: "ultimate",
			id: "scrapColossus",
			explosive: true,
		},
		visualIntensity: 1.8,
		visualParticleCount: 88,
	})
	for (const hit of explosion.hits) {
		applyKnockbackImpulse(hit.target, direction, 150 * power)
	}
	spawnFlash(pos, 68, k.WHITE)
	spawnRing({
		pos: pos.clone(),
		speed: 560,
		intensity: 1.5,
		maxRadius: 240,
		color: k.WHITE,
		visualOpacity: 1,
	})
	disassembleColossus(pos, records)
	k.shake(18)
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared === 0) return point.dist(start)
	const progress = k.clamp(
		point.sub(start).dot(segment) / lengthSquared,
		0,
		1
	)
	return point.dist(start.add(segment.scale(progress)))
}

function spawnAssemblyStreak(start: Vec2, target: GameObj<PosComp>) {
	const streak = k.add([
		k.pos(),
		k.opacity(0.8),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			draw() {
				if (!target.exists()) return
				k.drawLine({
					p1: start,
					p2: target.pos,
					width: 2,
					color: k.rgb(120, 220, 255),
					opacity: this.opacity,
				})
			},
		},
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("effects", streak, () => {
		streak.elapsed += k.dt()
		streak.opacity = k.lerp(0.8, 0, k.clamp(streak.elapsed / 0.45, 0, 1))
		if (streak.elapsed >= 0.45) k.destroy(streak)
	})
}

function fireColossusVolley(colossus: GameObj, partCount: number, power: number) {
	const target = findClosestSpatial(colossus.pos, 620, {
		allTags: [tags.enemy, tags.unit],
	})
	if (!target) return
	const direction = target.pos.sub(colossus.pos).unit()
	const cannonCount = k.clamp(2 + Math.floor(partCount / 3), 2, 6)
	for (let index = 0; index < cannonCount; index++) {
		const spread = cannonCount === 1
			? 0
			: -16 + 32 * index / (cannonCount - 1)
		const shotDirection = k.Vec2.fromAngle(direction.angle() + spread)
		spawnProjectile({
			pos: colossus.pos.add(shotDirection.scale(22)),
			dir: shotDirection,
			rotation: shotDirection.angle() + 90,
			sprite: "particle3",
			tint: k.rgb(195, 230, 240),
			effectTint: k.rgb(195, 230, 240),
			visualScale: 0.85,
			visualLengthScale: 1.8,
			speed: 320,
			tags: [tags.friendly, tags.blaster],
			impact: { damage: (5 + partCount * 0.32) * power },
			seek: {
				enabled: true,
				acquireDelay: 0,
				seekDistance: 680,
				turnSpeed: SCRAP_COLOSSUS_PROJECTILE_TURN_SPEED,
				targetTags: [tags.enemy],
			},
			lifespan: { duration: 3.2 },
			combatCredit: { kind: "ultimate", id: "scrapColossus" },
		})
	}
	spawnFlash(colossus.pos.add(direction.scale(24)), 8, k.WHITE)
	gameSoundService.playPositional("weapon_standard_blaster_fire", colossus.pos, {
		volume: mainSoundVolume * 0.38,
		detune: -180,
	})
	k.shake(0.8)
}

function disassembleColossus(pos: Vec2, records: PersistentShipPartRecord[]) {
	spawnFlash(pos, 36, k.WHITE)
	spawnRing({
		pos,
		speed: 430,
		intensity: 0.9,
		maxRadius: 180,
		color: k.WHITE,
	})
	createExplosion({
		pos,
		radius: 95,
		damage: 18,
		combatCredit: {
			kind: "ultimate",
			id: "scrapColossus",
			explosive: true,
		},
		visualIntensity: 1.1,
		visualParticleCount: 48,
	})
	for (const record of records) {
		const direction = k.Vec2.fromAngle(k.rand(0, 360))
		spawnPersistentShipPart(pos.add(direction.scale(k.rand(4, 18))), record.sprite, {
			force: k.rand(80, 145),
			direction,
			angle: record.angle,
			scale: record.scale,
			salvageValue: record.salvageValue,
			material: record.material,
		})
	}
	gameSoundService.playPositional("explosion1", pos, {
		volume: mainSoundVolume * 0.85,
		detune: -220,
	})
	k.shake(11)
}
