import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { player } from "../player"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"
import { applyDamage } from "./damageService"
import { forEachSpatialNearby } from "./runtimeSpatialIndexService"
import { audioService } from "./audioService"

const SAW_ORBIT_RADIUS = 42
const SAW_DAMAGE = 3
const SAW_HIT_COOLDOWN = 0.28
const RAM_DAMAGE = 6
const RAM_HIT_COOLDOWN = 0.45
const NEAR_MISS_INNER_RADIUS = 18
const NEAR_MISS_OUTER_RADIUS = 42
const NEAR_MISS_REQUIRED = 5
const NEAR_MISS_BURST_RADIUS = 180
const NEAR_MISS_BURST_DAMAGE = 8
const RESONANCE_DAMAGE_THRESHOLD = 8

let sawSatellite: GameObj | undefined
let sawOrbitAngle = 0
let nearMissCharge = 0
let phaseCounterCharge = 0
let resonanceReadyAt = 0
let resonanceCooldownDuration = 0
let tacticalFeedbackReadyAt = 0
let wreckFeedbackReadyAt = 0
const procSerials = {
	tacticalUplink: 0,
	phaseCounter: 0,
	resonanceCoil: 0,
	wreckHarvester: 0,
}

export interface StackingRewardFeedbackSnapshot {
	phaseCounterCharge: number
	phaseCounterCapacity: number
	resonanceCooldownRemaining: number
	resonanceCooldownDuration: number
	threatTierBonus: number
	procSerials: typeof procSerials
}
let grazedProjectiles = new WeakSet<object>()
let sawHitTimes = new WeakMap<object, number>()
let ramHitTimes = new WeakMap<object, number>()

export function resetPassiveUpgradeRuntime() {
	if (sawSatellite?.exists()) k.destroy(sawSatellite)
	sawSatellite = undefined
	sawOrbitAngle = 0
	nearMissCharge = 0
	phaseCounterCharge = 0
	resonanceReadyAt = 0
	resonanceCooldownDuration = 0
	tacticalFeedbackReadyAt = 0
	wreckFeedbackReadyAt = 0
	for (const key of Object.keys(procSerials) as (keyof typeof procSerials)[]) {
		procSerials[key] = 0
	}
	grazedProjectiles = new WeakSet<object>()
	sawHitTimes = new WeakMap<object, number>()
	ramHitTimes = new WeakMap<object, number>()
}

export function updatePassiveUpgradeRuntime(
	playerObj: GameObj<PosComp>,
	isBoosting: boolean
) {
	updateSawSatellite(playerObj)
	updateKineticRam(playerObj, isBoosting)
	updateNearMissCapacitor(playerObj)
}

function updateSawSatellite(playerObj: GameObj<PosComp>) {
	if (player.sawSatellite === undefined) {
		if (sawSatellite?.exists()) k.destroy(sawSatellite)
		sawSatellite = undefined
		return
	}
	if (!sawSatellite?.exists()) {
		sawSatellite = k.add([
			k.pos(playerObj.pos),
			k.sprite("saw_satellite_upg1"),
			k.anchor("center"),
			k.rotate(0),
			k.color(k.WHITE),
			k.layer(layers.gameEffects),
			k.z(2),
			tags.friendly,
			tags.gameLoop,
		])
	}

	sawOrbitAngle = (sawOrbitAngle + k.dt() * 150) % 360
	sawSatellite.pos = playerObj.pos.add(
		k.Vec2.fromAngle(sawOrbitAngle).scale(SAW_ORBIT_RADIUS)
	)
	sawSatellite.angle = (sawSatellite.angle + k.dt() * 540) % 360

	forEachSpatialNearby(sawSatellite.pos, 9, {
		allTags: [tags.projectile, tags.enemy],
	}, (projectile) => {
		if (projectile.exists()) k.destroy(projectile)
	})
	forEachSpatialNearby(sawSatellite.pos, 18, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		const nextHitAt = sawHitTimes.get(enemy) ?? 0
		if (k.time() < nextHitAt) return
		if (!applyDamage(enemy, SAW_DAMAGE, { position: sawSatellite?.pos })) return
		sawHitTimes.set(enemy, k.time() + SAW_HIT_COOLDOWN)
		spawnFlash(sawSatellite!.pos.clone(), 5, k.WHITE)
	})
}

function updateKineticRam(playerObj: GameObj<PosComp>, isBoosting: boolean) {
	if (player.kineticRam === undefined || !isBoosting) return
	forEachSpatialNearby(playerObj.pos, 30, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		const nextHitAt = ramHitTimes.get(enemy) ?? 0
		if (k.time() < nextHitAt) return
		if (!applyDamage(enemy, RAM_DAMAGE, { position: enemy.pos?.clone() })) return
		ramHitTimes.set(enemy, k.time() + RAM_HIT_COOLDOWN)
		const away = enemy.pos.sub(playerObj.pos)
		if (away.len() > 0.001) enemy.pos = enemy.pos.add(away.unit().scale(18))
		spawnFlash(enemy.pos.clone(), 9, k.rgb(90, 210, 255))
	})
}

function updateNearMissCapacitor(playerObj: GameObj<PosComp>) {
	if (
		player.nearMissCapacitor === undefined &&
		player.phaseCounterCapacity <= 0
	) return
	forEachSpatialNearby(playerObj.pos, NEAR_MISS_OUTER_RADIUS, {
		allTags: [tags.projectile, tags.enemy],
	}, (projectile) => {
		if (grazedProjectiles.has(projectile)) return
		if (projectile.pos.dist(playerObj.pos) <= NEAR_MISS_INNER_RADIUS) return
		grazedProjectiles.add(projectile)
		if (player.phaseCounterCapacity > 0) {
			const previousCharge = phaseCounterCharge
			phaseCounterCharge = Math.min(
				player.phaseCounterCapacity,
				phaseCounterCharge + 1
			)
			if (phaseCounterCharge > previousCharge) {
				procSerials.phaseCounter++
				spawnRing({
					pos: playerObj.pos.clone(),
					speed: 90,
					intensity: 0.22,
					maxRadius: 24,
					color: k.rgb(80, 180, 255),
				})
				audioService.playSound("rail_lance_ready", {
					volume: mainSoundVolume * 0.28,
					detune: phaseCounterCharge * 45,
				})
			}
		}
		if (player.nearMissCapacitor === undefined) {
			spawnFlash(playerObj.pos.clone(), 4, k.rgb(80, 180, 255))
			return
		}
		nearMissCharge++
		spawnFlash(playerObj.pos.clone(), 4, k.rgb(80, 180, 255))
		if (nearMissCharge < NEAR_MISS_REQUIRED) return
		nearMissCharge = 0
		spawnNearMissBurst(playerObj)
	})
}

export function consumePhaseCounterMultiplier(projectile: GameObj) {
	if (projectile.phaseCounterConsumed === true) {
		return projectile.phaseCounterMultiplier ?? 1
	}
	if (
		phaseCounterCharge <= 0 ||
		!projectile.tags.includes(tags.friendly)
	) return 1
	phaseCounterCharge--
	procSerials.phaseCounter++
	projectile.phaseCounterConsumed = true
	projectile.phaseCounterMultiplier = 2
	projectile.color = k.rgb(90, 200, 255)
	spawnRing({
		pos: projectile.pos.clone(),
		speed: 150,
		intensity: 0.3,
		maxRadius: 30,
		color: k.rgb(90, 200, 255),
	})
	spawnFlash(projectile.pos.clone(), 7, k.rgb(90, 200, 255))
	audioService.playSound("powerup1", {
		volume: mainSoundVolume * 0.32,
		detune: 160,
	})
	return 2
}

export function triggerTacticalUplinkFeedback(position: Vec2) {
	if (k.time() < tacticalFeedbackReadyAt) return
	tacticalFeedbackReadyAt = k.time() + 0.1
	procSerials.tacticalUplink++
	spawnRing({
		pos: position.clone(),
		speed: 180,
		intensity: 0.25,
		maxRadius: 28,
		color: k.WHITE,
	})
	spawnFlash(position.clone(), 6, k.WHITE)
	audioService.playSound("hit2", {
		volume: mainSoundVolume * 0.22,
		detune: 220,
	})
}

export function triggerResonanceCoil(
	target: GameObj,
	projectile: GameObj,
	directDamage: number
) {
	const stacks = player.resonanceCoilStacks
	if (
		stacks <= 0 ||
		directDamage < RESONANCE_DAMAGE_THRESHOLD ||
		!projectile.tags.includes(tags.friendly) ||
		k.time() < resonanceReadyAt
	) return

	const cooldown = Math.max(4, 9 - stacks)
	const radius = 60 + stacks * 10
	const damage = 1.5 + stacks * 1.5
	resonanceReadyAt = k.time() + cooldown
	resonanceCooldownDuration = cooldown
	procSerials.resonanceCoil++
	forEachSpatialNearby(projectile.pos, radius, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		if (enemy.id === target.id) return
		applyDamage(enemy, damage, { position: enemy.pos?.clone() })
	})
	spawnRing({
		pos: projectile.pos.clone(),
		speed: 320,
		intensity: 0.4,
		maxRadius: radius,
		color: k.WHITE,
	})
	spawnFlash(projectile.pos.clone(), 12, k.WHITE)
	audioService.playSound("crit1", {
		volume: mainSoundVolume * 0.55,
		detune: -120,
	})
	k.shake(2)
}

export function triggerWreckHarvesterFeedback(position: Vec2) {
	procSerials.wreckHarvester++
	if (k.time() < wreckFeedbackReadyAt) return
	wreckFeedbackReadyAt = k.time() + 0.1
	spawnRing({
		pos: position.clone(),
		speed: 130,
		intensity: 0.2,
		maxRadius: 26,
		color: k.rgb(100, 200, 255),
	})
	audioService.playSound("powerup1", {
		volume: mainSoundVolume * 0.24,
		detune: -80,
	})
}

export function getStackingRewardFeedbackSnapshot(): StackingRewardFeedbackSnapshot {
	return {
		phaseCounterCharge,
		phaseCounterCapacity: player.phaseCounterCapacity,
		resonanceCooldownRemaining: Math.max(0, resonanceReadyAt - k.time()),
		resonanceCooldownDuration,
		threatTierBonus: player.threatReactorStacks,
		procSerials: { ...procSerials },
	}
}

function spawnNearMissBurst(playerObj: GameObj<PosComp>) {
	forEachSpatialNearby(playerObj.pos, NEAR_MISS_BURST_RADIUS, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		applyDamage(enemy, NEAR_MISS_BURST_DAMAGE, { position: enemy.pos?.clone() })
	})
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 380,
		intensity: 0.45,
		maxRadius: NEAR_MISS_BURST_RADIUS,
		color: k.rgb(80, 180, 255),
	})
	spawnFlash(playerObj.pos.clone(), 18, k.rgb(80, 180, 255))
	k.shake(4)
}
